import type {
  AssistantCard,
  AssistantQuestion,
  AssistantRating,
} from "@tick-taka/shared/schemas/ai";
import type { ChatMessage } from "./chat-store";
import { parseQuestion } from "./question-form";

/**
 * Chats kept on the server (GET /ai/threads/:id) turned into the browser's chat, and
 * a newer server copy folded into the one on screen. Pure, so it can be tested.
 */

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  memo: string | null;
  cards: AssistantCard[];
  actions: { summary: string }[];
  rating: AssistantRating | null;
  /** Tiki's small form, when it asked with one; older servers leave it out. */
  question?: AssistantQuestion | null;
  createdAt: number;
}

/**
 * The chat kept in this browser, read back: anything that isn't a message (damaged
 * storage, a stray entry) is dropped rather than breaking the chat. Older messages,
 * from before questions, cards and chats on the server, read as they are.
 */
export function keptMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is ChatMessage =>
      typeof item === "object" &&
      item !== null &&
      typeof item.id === "string" &&
      (item.role === "user" || item.role === "assistant") &&
      typeof item.content === "string" &&
      typeof item.at === "number",
  );
}

/** One stored message as the chat shows it. Undo isn't kept on the server, so none here. */
export function fromStored(message: StoredMessage): ChatMessage {
  const question = message.role === "assistant" ? parseQuestion(message.question) : undefined;
  return {
    id: `stored-${message.id}`,
    role: message.role,
    content: message.content,
    ...(message.memo ? { memo: message.memo } : {}),
    ...(message.actions.length
      ? { actions: message.actions.map(({ summary }) => ({ summary })) }
      : {}),
    ...(message.role === "assistant"
      ? { messageId: message.id, cards: message.cards, rating: message.rating }
      : {}),
    ...(question ? { question } : {}),
    at: message.createdAt,
  };
}

/** Whether the server has replies this browser hasn't seen (sent from another device). */
export function hasNewReplies(local: readonly ChatMessage[], stored: StoredMessage[]): boolean {
  const known = new Set(local.flatMap((message) => (message.messageId ? [message.messageId] : [])));
  return stored.some((message) => message.role === "assistant" && !known.has(message.id));
}

/**
 * The server's chat, keeping this browser's copy of each reply it already has: those
 * still hold their Undo, drafts and steps. Replies are matched by id; each user
 * message is matched to the local one just before a matched reply.
 */
export function mergeStored(local: readonly ChatMessage[], stored: StoredMessage[]): ChatMessage[] {
  const byReply = new Map<string, number>();
  local.forEach((message, index) => {
    if (message.messageId) byReply.set(message.messageId, index);
  });
  return stored.map((message, index) => {
    const replyId = message.role === "assistant" ? message.id : stored[index + 1]?.id;
    const at = replyId === undefined ? undefined : byReply.get(replyId);
    if (at === undefined) return fromStored(message);
    const mine = message.role === "assistant" ? local[at] : local[at - 1];
    return mine && mine.role === message.role ? mine : fromStored(message);
  });
}
