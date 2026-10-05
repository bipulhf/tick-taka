import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { ApiError, api, unwrap } from "@/lib/api";
import { haptic } from "@/lib/haptics";
import { useOutbox } from "@/lib/outbox";
import { queryClient } from "@/lib/query-client";
import { editTime } from "@/lib/server-clock";
import { useStore } from "@/lib/store";
import {
  appendMessage,
  type ChatAction,
  chatStore,
  clearChat,
  loadChat,
  markUndone,
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

/** The chat with Tiki: history on the phone, the thinking and the changes on the server. */
export function useAssistant() {
  const messages = useStore(chatStore);
  const send = useOutbox();
  useEffect(() => {
    if (chatStore.get().length === 0) void loadChat();
  }, []);

  const chat = useMutation({
    mutationFn: (history: { role: "user" | "assistant"; content: string; memo?: string }[]) =>
      unwrap(api.ai.assistant.$post({ json: { messages: history } })),
  });

  const ask = async (text: string) => {
    const content = text.trim();
    if (!content || chat.isPending) return;
    appendMessage({ role: "user", content });
    const history = chatStore
      .get()
      .filter((message) => !message.failed)
      .slice(-HISTORY)
      .map(({ role, content: body, memo }) => ({
        role,
        content: body.slice(0, 4000),
        ...(memo ? { memo } : {}),
      }));
    try {
      const result = await chat.mutateAsync(history);
      appendMessage({
        role: "assistant",
        content: result.reply,
        memo: result.memo || undefined,
        actions: result.actions as ChatAction[],
      });
      if (result.actions.length) {
        haptic.success();
        void queryClient.invalidateQueries();
      }
    } catch (error) {
      appendMessage({ role: "assistant", content: errorText(error), failed: true });
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

  return { messages, ask, undo, clear: clearChat, thinking: chat.isPending };
}
