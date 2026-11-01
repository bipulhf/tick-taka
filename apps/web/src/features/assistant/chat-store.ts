import type {
  AssistantCard,
  AssistantQuestion,
  AssistantRating,
} from "@tick-taka/shared/schemas/ai";
import type { HttpMethod } from "@/lib/api";
import { tokenStore } from "@/lib/auth";
import { createStore } from "@/lib/store";
import type { ChatDraft } from "./money-drafts";
import { keptMessages } from "./stored-chat";

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

/** A record Tiki asked to delete. Nothing happens until the user clicks Delete. */
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
  /** Money changes Tiki proposed; each is saved only when the user clicks Save. */
  drafts?: ChatDraft[];
  /** The request failed; kept on screen but never sent back as context. */
  failed?: boolean;
  /**
   * The stream dropped mid-turn: the server may have made changes the browser never
   * heard about between these server times. Cleared once they have been looked up.
   */
  recover?: { since: number; until: number };
  /** The reply's id on the server, once the chat is kept there; it can then be rated. */
  messageId?: string;
  /** Records and totals in the reply, to click or glance at. */
  cards?: AssistantCard[];
  /** Tiki asked with a small form; it can be answered until a later message exists. */
  question?: AssistantQuestion;
  rating?: AssistantRating | null;
  at: number;
}

const KEY = "tt.assistant-chat";
const KEEP = 60;

function read(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    return keptMessages(raw ? JSON.parse(raw) : []);
  } catch {
    // Unreadable storage: the chat just starts empty.
    return [];
  }
}

/** The chat with Tiki, kept in this browser (the last 60 messages). */
export const chatStore = createStore<ChatMessage[]>(read());

function save(messages: ChatMessage[]) {
  const kept = messages.slice(-KEEP);
  chatStore.set(kept);
  try {
    if (kept.length) localStorage.setItem(KEY, JSON.stringify(kept));
    else localStorage.removeItem(KEY);
  } catch {}
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

/** Shows another chat: the messages of a chat loaded from the server. */
export function replaceChat(messages: ChatMessage[]) {
  save(messages);
}

// Signing out takes the chat with it; the next person starts with their own.
tokenStore.subscribe(() => {
  if (!tokenStore.get()) save([]);
});

// Another tab talked to Tiki: show the same chat here.
window.addEventListener("storage", (event) => {
  if (event.key === KEY) chatStore.set(read());
});
