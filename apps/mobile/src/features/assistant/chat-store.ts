import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HttpMethod } from "@/lib/api";
import { createStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";

export interface ChatAction {
  summary: string;
  undo?: { method: HttpMethod; path: string; body?: Record<string, unknown> };
  undone?: boolean;
}

/** One thing Tiki did while working on a message; ok is unset while it's running. */
export interface ChatStep {
  text: string;
  ok?: boolean;
}

/** A record Tiki asked to delete. Nothing happens until the user taps Delete. */
export interface ChatDeletion {
  summary: string;
  /** DELETE removes it; POST `${path}/restore` brings it back. */
  path: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** What the assistant changed, with ids, sent back so follow-ups like "move it" work. */
  memo?: string;
  actions?: ChatAction[];
  /** The steps Tiki took to get there, shown folded under the reply. */
  steps?: ChatStep[];
  /** Deletions waiting for the user's yes or no, and what they chose. */
  deletions?: ChatDeletion[];
  deletionChoice?: "pending" | "deleted" | "kept";
  /** The request failed; kept on screen but never sent back as context. */
  failed?: boolean;
  /**
   * The stream dropped mid-turn: the server may have made changes the phone never
   * heard about between these server times. Cleared once they have been looked up.
   */
  recover?: { since: number; until: number };
  at: number;
}

const KEY = "tt.assistant-chat";
const KEEP = 60;

export const chatStore = createStore<ChatMessage[]>([]);
resetOnSignOut(() => chatStore.set([]));

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

export function updateMessage(messageId: string, change: (message: ChatMessage) => ChatMessage) {
  save(chatStore.get().map((message) => (message.id === messageId ? change(message) : message)));
}

export function clearChat() {
  save([]);
}
