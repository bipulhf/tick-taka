import type { AssistantCard, AssistantRating, AssistantScreen } from "@tick-taka/shared/schemas/ai";
import { useEffect } from "react";
import { ApiError, api, unwrap } from "@/lib/api";
import { friendlyError } from "@/lib/error-copy";
import { useIsOnline } from "@/lib/online";
import { queryClient } from "@/lib/query-client";
import { createStore, useStore } from "@/lib/store";
import { notify, notifyError } from "@/lib/toast";
import { type WriteRequest, write } from "@/lib/write";
import {
  appendMessage,
  type ChatAction,
  type ChatDeletion,
  type ChatStep,
  chatStore,
  markUndone,
  updateMessage,
} from "./chat-store";
import { threadIdForSend, threadIdStore } from "./current-thread";
import { postEventStream } from "./event-stream";
import { draftOutcome, draftRequest, parseDrafts } from "./money-drafts";
import { ownWrites } from "./own-writes";
import { parseQuestion } from "./question-form";
import { recoverDroppedTurns, SETTLE_MS } from "./recover-turn";
import { deletedMemo, deletionsRefused, undoRefused } from "./refused-writes";
import { serverNow } from "./server-clock";
import { refreshThreads, startNewChat } from "./threads";

const HISTORY = 20;

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.code === "ai_disabled")
    return "The assistant is switched off in Settings › Tiki and AI.";
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
      /** Records and totals to show under the reply; older servers omit it. */
      cards?: AssistantCard[];
      /** The stored reply, when the chat is kept on the server. */
      messageId?: string;
      /** Tiki asked with a small form; older servers omit it. */
      question?: unknown;
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

/** A DELETE answered 404: the record is gone already, which is what was asked. */
const alreadyGone = (method: string, error: unknown) =>
  method === "DELETE" && error instanceof ApiError && error.status === 404;

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

  /** Sends a message, with what's on screen so "this" and "here" mean something. */
  const ask = async (text: string, screen?: AssistantScreen) => {
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
    // The chat is kept on the server under this id (made with its first message).
    const threadId = threadIdForSend();
    // Another chat open now (switched, deleted, signed out): the reply stays on the server.
    const here = () => threadIdStore.get() === threadId;
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
      const body = { messages: history, draftMoney: true, threadId, ...(screen ? { screen } : {}) };
      await postEventStream("/ai/assistant", body, (data) => {
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
          case "error": {
            finished = true;
            // Changes made before the error still happened; keep their Undo.
            const done = liveStore.get()?.actions ?? [];
            if (done.length) void queryClient.invalidateQueries();
            if (!here()) return;
            appendMessage({
              role: "assistant",
              content: errorText(new ApiError(500, event.code, event.message)),
              actions: done,
              steps: settled(),
              failed: true,
            });
            return;
          }
          case "done": {
            finished = true;
            if (event.actions.length) void queryClient.invalidateQueries();
            if (!here()) return;
            const drafts = parseDrafts(event.drafts);
            const question = parseQuestion(event.question);
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
              ...(event.cards?.length ? { cards: event.cards } : {}),
              ...(question ? { question } : {}),
              ...(event.messageId ? { messageId: event.messageId, rating: null } : {}),
            });
            return;
          }
        }
      });
      if (!finished) throw new Error("The reply stopped part way");
    } catch (error) {
      if (!finished) {
        // Changes made before the stream broke still happened; keep their Undo.
        const done = liveStore.get()?.actions ?? [];
        if (done.length) void queryClient.invalidateQueries();
        if (!here()) return;
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
        if (dropped) setTimeout(() => void recoverDroppedTurns(), SETTLE_MS + 500);
      }
    } finally {
      liveStore.set(null);
      // The chat list shows this chat (new, or newest now).
      refreshThreads();
    }
  };

  const undo = (messageId: string, index: number) => {
    const action = chatStore.get().find((m) => m.id === messageId)?.actions?.[index];
    if (!action?.undo || action.undone) return;
    const { method, path, body } = action.undo;
    // The server stamps the edit time; nothing to add to a PATCH here.
    // A refusal is said in the toast, with Retry; the row offers Undo again.
    chatWrite({ method, path, body, label: "Couldn't undo that" }).catch((error: unknown) => {
      if (!alreadyGone(method, error)) updateMessage(messageId, (m) => undoRefused(m, index));
    });
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
    ).then((results) => {
      // Refusals are said in their toasts; the card asks again about those.
      const refused = deletions.filter((_, i) => {
        const result = results[i];
        return result?.status === "rejected" && !alreadyGone("DELETE", result.reason);
      });
      if (refused.length) updateMessage(messageId, (m) => deletionsRefused(m, deletions, refused));
      void queryClient.invalidateQueries();
    });
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
      memo: [m.memo, deletedMemo(deletions)].filter(Boolean).join("; "),
    }));
  };

  /** The user clicked Save on a proposed money change: the browser sends it, with Undo. */
  const saveDraft = (messageId: string, index: number) => {
    const draft = chatStore.get().find((m) => m.id === messageId)?.drafts?.[index];
    if (draft?.state !== "pending") return;
    const saved = `Saved: ${lowerFirst(draft.summary)}`;
    const savedMemo = `the user saved the draft "${draft.summary}" (${draft.method} ${draft.path})`;
    chatWrite(draftRequest(draft))
      .then((response) => {
        const note = draftOutcome(draft, response);
        if (note) notify(note);
      })
      // A refusal is said in the toast, with Retry; the card goes back to Save, not "Saved".
      .catch(() =>
        updateMessage(messageId, (m) => ({
          ...m,
          drafts: m.drafts?.map((d, i) => (i === index ? { ...d, state: "pending" as const } : d)),
          actions: m.actions?.filter((a) => a.summary !== saved),
          memo: m.memo
            ?.split("; ")
            .filter((part) => part !== savedMemo)
            .join("; "),
        })),
      );
    updateMessage(messageId, (m) => ({
      ...m,
      drafts: m.drafts?.map((d, i) => (i === index ? { ...d, state: "saved" as const } : d)),
      actions: [...(m.actions ?? []), { summary: saved, undo: draft.undo }],
      memo: [m.memo, savedMemo].filter(Boolean).join("; "),
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

  /** A thumbs up or down on a stored reply; rating again (or adding a comment) replaces it. */
  const rate = (id: string, rating: AssistantRating, comment?: string) => {
    const message = chatStore.get().find((m) => m.id === id);
    if (!message?.messageId) return;
    const before = message.rating ?? null;
    updateMessage(id, (m) => ({ ...m, rating }));
    const json = { messageId: message.messageId, rating, ...(comment ? { comment } : {}) };
    unwrap(api.ai.feedback.$post({ json }))
      .then(() => {
        if (comment) notify("Thanks. That helps Tiki get better.");
      })
      .catch((error: unknown) => {
        updateMessage(id, (m) => ({ ...m, rating: before }));
        notifyError(`Couldn't send that. ${friendlyError(error, "save")}`);
      });
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
    rate,
    clear: startNewChat,
    thinking: live !== null,
  };
}
