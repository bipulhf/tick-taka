import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HttpMethod } from "@/lib/api";
import { createStore } from "@/lib/store";

export interface ChatAction {
  summary: string;
  undo?: { method: HttpMethod; path: string; body?: Record<string, unknown> };
  undone?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** What the assistant changed, with ids, sent back so follow-ups like "move it" work. */
  memo?: string;
  actions?: ChatAction[];
  /** The request failed; kept on screen but never sent back as context. */
  failed?: boolean;
  at: number;
}

const KEY = "tt.assistant-chat";
const KEEP = 60;

export const chatStore = createStore<ChatMessage[]>([]);

export async function loadChat() {
  const raw = await AsyncStorage.getItem(KEY);
  if (raw) chatStore.set(JSON.parse(raw) as ChatMessage[]);
}

function save(messages: ChatMessage[]) {
  const kept = messages.slice(-KEEP);
  chatStore.set(kept);
  void AsyncStorage.setItem(KEY, JSON.stringify(kept));
}

export function appendMessage(message: Omit<ChatMessage, "id" | "at">) {
  save([...chatStore.get(), { ...message, id: `${Date.now()}-${Math.random()}`, at: Date.now() }]);
}

export function markUndone(messageId: string, index: number) {
  save(
    chatStore.get().map((message) =>
      message.id === messageId
        ? {
            ...message,
            actions: message.actions?.map((action, i) =>
              i === index ? { ...action, undone: true } : action,
            ),
          }
        : message,
    ),
  );
}

export function clearChat() {
  save([]);
}
