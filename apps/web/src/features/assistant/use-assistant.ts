import { useEffect } from "react";
import { ApiError } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useIsOnline } from "@/lib/online";
import { queryClient } from "@/lib/query-client";
import { createStore, useStore } from "@/lib/store";
import { notify } from "@/lib/toast";
import { type WriteRequest, write } from "@/lib/write";
import {
  appendMessage,
  type ChatAction,
  type ChatDeletion,
  type ChatStep,
  chatStore,
  clearChat,
  markUndone,
  updateMessage,
} from "./chat-store";
import { postEventStream } from "./event-stream";
import { draftOutcome, draftRequest, parseDrafts } from "./money-drafts";
import { ownWrites } from "./own-writes";
import { recoverDroppedTurns, SETTLE_MS } from "./recover-turn";
import { serverNow } from "./server-clock";

const HISTORY = 20;

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.code === "ai_disabled")
    return "The assistant is switched off in Settings › AI.";
  if (error instanceof ApiError) return friendlyError(error);
  return "I couldn't connect just now. Check your internet and try again.";
}

type StreamEvent =
  | { type: "status"; text: string }
  | { type: "result"; ok: boolean }
  | { type: "delta"; text: string }
  | { type: "reset" }
  | { type: "action"; action: ChatAction }
  | {
      type: "done";
      reply: string;
      actions: ChatAction[];
      deletions: ChatDeletion[];
      /** Proposed money changes (we always ask for drafts); older servers omit it. */
      drafts?: unknown;
      memo: string;
    }
  | { type: "error"; code: string; message: string };

/** Tiki's turn while it's still working: the steps so far and the reply as it streams in. */
export interface LiveTurn {
  steps: ChatStep[];
  actions: ChatAction[];
  text: string;
}

const liveStore = createStore<LiveTurn | null>(null);

const lowerFirst = (text: string) => `${text[0]?.toLowerCase() ?? ""}${text.slice(1)}`;

/** A write from the chat itself, remembered so a dropped turn never claims it as Tiki's. */
async function chatWrite(request: WriteRequest): Promise<unknown> {
  const response = await write(request);
  ownWrites.record(request.path, request.body, response);
  return response;
}

/** The chat with Tiki: history in the browser, the work on the server, streamed as it happens. */
export function useAssistant() {
  const messages = useStore(chatStore);
  const live = useStore(liveStore);
  const online = useIsOnline();
  // Look up what a dropped turn changed, once the connection is back.
  useEffect(() => {
    if (online) void recoverDroppedTurns();
  }, [online]);

  const ask = async (text: string) => {
    const content = text.trim();
    if (!content || liveStore.get()) return;
    appendMessage({ role: "user", content });
    const history = chatStore
      .get()
      .filter((message) => !message.failed)
      .slice(-HISTORY)
      .map(({ role, content: body, memo }) => ({
        role,
        content: body.slice(0, 4000),
        ...(memo ? { memo: memo.slice(-3900) } : {}),
      }));
    liveStore.set({ steps: [], actions: [], text: "" });
    const change = (update: (turn: LiveTurn) => LiveTurn) => {
      const turn = liveStore.get();
      if (turn) liveStore.set(update(turn));
    };
    let finished = false;
    // When the turn began, to find what it changed if the stream drops. Turned into
    // server time afterwards, once the reply's headers have taught the clock offset.
    const sentAt = Date.now();
    const startedAt = () => serverNow() - (Date.now() - sentAt);
    /** The steps so far, with any still running marked as cut short. */
    const settled = () => liveStore.get()?.steps.map((step) => ({ ok: false, ...step })) ?? [];
    try {
      // Money is never written by the AI on its own: it comes back as drafts to confirm.
      await postEventStream("/ai/assistant", { messages: history, draftMoney: true }, (data) => {
        const event = data as StreamEvent;
        switch (event.type) {
          case "status":
            return change((turn) => ({ ...turn, steps: [...turn.steps, { text: event.text }] }));
          case "result":
            return change((turn) => ({
              ...turn,
              steps: turn.steps.map((step, i) =>
                i === turn.steps.length - 1 ? { ...step, ok: event.ok } : step,
              ),
            }));
          case "delta":
            return change((turn) => ({ ...turn, text: turn.text + event.text }));
          case "reset":
            return change((turn) => ({ ...turn, text: "" }));
          case "action":
            return change((turn) => ({ ...turn, actions: [...turn.actions, event.action] }));
          case "error":
            finished = true;
            return appendMessage({
              role: "assistant",
              content: errorText(new ApiError(500, event.code, event.message)),
              steps: settled(),
              failed: true,
            });
          case "done": {
            finished = true;
            const drafts = parseDrafts(event.drafts);
            appendMessage({
              role: "assistant",
              content: event.reply,
              memo: event.memo || undefined,
              actions: event.actions,
              steps: settled(),
              ...(event.deletions.length
                ? { deletions: event.deletions, deletionChoice: "pending" as const }
                : {}),
              ...(drafts.length ? { drafts } : {}),
            });
            if (event.actions.length) void queryClient.invalidateQueries();
            return;
          }
        }
      });
      if (!finished) throw new Error("The reply stopped part way");
    } catch (error) {
      if (!finished) {
        // Changes made before the stream broke still happened; keep their Undo.
        const done = liveStore.get()?.actions ?? [];
        // An ApiError came before the stream started: the server did nothing. Anything
        // else dropped mid-turn, and the server may have gone on making changes.
        const dropped = !(error instanceof ApiError);
        appendMessage({
          role: "assistant",
          content: errorText(error),
          actions: done,
          steps: settled(),
          failed: true,
          ...(dropped ? { recover: { since: startedAt(), until: serverNow() + 180_000 } } : {}),
        });
        if (done.length) void queryClient.invalidateQueries();
        if (dropped) setTimeout(() => void recoverDroppedTurns(), SETTLE_MS + 500);
      }
    } finally {
      liveStore.set(null);
    }
  };

  const undo = (messageId: string, index: number) => {
    const action = chatStore.get().find((m) => m.id === messageId)?.actions?.[index];
    if (!action?.undo || action.undone) return;
    const { method, path, body } = action.undo;
    // The server stamps the edit time; nothing to add to a PATCH here.
    void chatWrite({ method, path, body, label: "Couldn't undo that" }).catch(() => {});
    markUndone(messageId, index);
  };

  /** The user said yes: the browser itself sends the deletions, each with an Undo. */
  const confirmDeletions = (messageId: string) => {
    const message = chatStore.get().find((m) => m.id === messageId);
    if (!message?.deletions?.length || message.deletionChoice !== "pending") return;
    const deletions = message.deletions;
    void Promise.allSettled(
      deletions.map((item) =>
        chatWrite({ method: "DELETE", path: item.path, label: "Couldn't delete that" }),
      ),
    ).then(() => queryClient.invalidateQueries());
    updateMessage(messageId, (m) => ({
      ...m,
      deletionChoice: "deleted",
      actions: [
        ...(m.actions ?? []),
        ...deletions.map(
          (item): ChatAction => ({
            summary: `Deleted ${lowerFirst(item.summary)}`,
            undo: { method: "POST", path: `${item.path}/restore` },
          }),
        ),
      ],
      memo: [m.memo, `the user confirmed and deleted ${deletions.map((d) => d.path).join(", ")}`]
        .filter(Boolean)
        .join("; "),
    }));
  };

  /** The user clicked Save on a proposed money change: the browser sends it, with Undo. */
  const saveDraft = (messageId: string, index: number) => {
    const draft = chatStore.get().find((m) => m.id === messageId)?.drafts?.[index];
    if (draft?.state !== "pending") return;
    chatWrite(draftRequest(draft))
      .then((response) => {
        const note = draftOutcome(draft, response);
        if (note) notify(note);
      })
      // A refusal is said in the toast, with Retry.
      .catch(() => {});
    updateMessage(messageId, (m) => ({
      ...m,
      drafts: m.drafts?.map((d, i) => (i === index ? { ...d, state: "saved" as const } : d)),
      actions: [
        ...(m.actions ?? []),
        { summary: `Saved: ${lowerFirst(draft.summary)}`, undo: draft.undo },
      ],
      memo: [m.memo, `the user saved the draft "${draft.summary}" (${draft.method} ${draft.path})`]
        .filter(Boolean)
        .join("; "),
    }));
  };

  const discardDraft = (messageId: string, index: number) => {
    const draft = chatStore.get().find((m) => m.id === messageId)?.drafts?.[index];
    if (draft?.state !== "pending") return;
    updateMessage(messageId, (m) => ({
      ...m,
      drafts: m.drafts?.map((d, i) => (i === index ? { ...d, state: "discarded" as const } : d)),
      memo: [m.memo, `the user discarded the draft "${draft.summary}"; nothing was saved`]
        .filter(Boolean)
        .join("; "),
    }));
  };

  const keepAll = (messageId: string) => {
    updateMessage(messageId, (m) => ({
      ...m,
      deletionChoice: "kept",
      memo: [m.memo, "the user chose to keep everything; nothing was deleted"]
        .filter(Boolean)
        .join("; "),
    }));
  };

  return {
    messages,
    live,
    ask,
    undo,
    confirmDeletions,
    keepAll,
    saveDraft,
    discardDraft,
    clear: clearChat,
    thinking: live !== null,
  };
}
