import { useEffect } from "react";
import { ApiError } from "@/lib/api";
import { postEventStream } from "@/lib/event-stream";
import { haptic } from "@/lib/haptics";
import { useOutbox } from "@/lib/outbox";
import { queryClient } from "@/lib/query-client";
import { editTime } from "@/lib/server-clock";
import { createStore, useStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";
import {
  appendMessage,
  type ChatAction,
  type ChatDeletion,
  type ChatStep,
  chatStore,
  clearChat,
  loadChat,
  markUndone,
  updateMessage,
} from "./chat-store";

const HISTORY = 20;

const ERRORS: Record<string, string> = {
  ai_disabled: "The assistant is switched off in Settings › AI.",
  ai_unavailable: "AI isn't set up on the server yet.",
  ai_cap_reached: "This month's AI budget is used up. Raise it in Settings › AI.",
};

function errorText(error: unknown): string {
  if (error instanceof ApiError) return ERRORS[error.code] ?? error.message;
  return "I couldn't reach the server. Check your connection and try again.";
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
resetOnSignOut(() => liveStore.set(null));

const lowerFirst = (text: string) => `${text[0]?.toLowerCase() ?? ""}${text.slice(1)}`;

/** The chat with Tiki: history on the phone, the work on the server, streamed as it happens. */
export function useAssistant() {
  const messages = useStore(chatStore);
  const live = useStore(liveStore);
  const send = useOutbox();
  useEffect(() => {
    if (chatStore.get().length === 0) void loadChat();
  }, []);

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
    /** The steps so far, with any still running marked as cut short. */
    const settled = () => liveStore.get()?.steps.map((step) => ({ ok: false, ...step })) ?? [];
    try {
      await postEventStream("/ai/assistant", { messages: history }, (data) => {
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
              content: ERRORS[event.code] ?? event.message,
              steps: settled(),
              failed: true,
            });
          case "done":
            finished = true;
            appendMessage({
              role: "assistant",
              content: event.reply,
              memo: event.memo || undefined,
              actions: event.actions,
              steps: settled(),
              ...(event.deletions.length
                ? { deletions: event.deletions, deletionChoice: "pending" as const }
                : {}),
            });
            if (event.actions.length) {
              haptic.success();
              void queryClient.invalidateQueries();
            }
        }
      });
      if (!finished) throw new Error("The reply stopped part way");
    } catch (error) {
      if (!finished) {
        // Changes made before the stream broke still happened; keep their Undo.
        const done = liveStore.get()?.actions ?? [];
        appendMessage({
          role: "assistant",
          content: errorText(error),
          actions: done,
          steps: settled(),
          failed: true,
        });
        if (done.length) void queryClient.invalidateQueries();
      }
    } finally {
      liveStore.set(null);
    }
  };

  const undo = (messageId: string, index: number) => {
    const action = chatStore.get().find((m) => m.id === messageId)?.actions?.[index];
    if (!action?.undo || action.undone) return;
    const { method, path, body } = action.undo;
    send({
      method,
      path,
      body: method === "PATCH" ? { ...body, updatedAt: editTime() } : body,
      label: "Couldn't undo that",
    });
    markUndone(messageId, index);
    haptic.tap();
  };

  /** The user said yes: the phone itself sends the deletions, each with an Undo. */
  const confirmDeletions = (messageId: string) => {
    const message = chatStore.get().find((m) => m.id === messageId);
    if (!message?.deletions?.length || message.deletionChoice !== "pending") return;
    const deletions = message.deletions;
    void Promise.allSettled(
      deletions.map((item) =>
        send.async({ method: "DELETE", path: item.path, label: "Couldn't delete that" }),
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
    haptic.success();
  };

  const keepAll = (messageId: string) => {
    updateMessage(messageId, (m) => ({
      ...m,
      deletionChoice: "kept",
      memo: [m.memo, "the user chose to keep everything; nothing was deleted"]
        .filter(Boolean)
        .join("; "),
    }));
    haptic.tap();
  };

  return {
    messages,
    live,
    ask,
    undo,
    confirmDeletions,
    keepAll,
    clear: clearChat,
    thinking: live !== null,
  };
}
