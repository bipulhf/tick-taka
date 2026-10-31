import type {
  AssistantCard,
  AssistantQuestion,
  AssistantRating,
} from "@tick-taka/shared/schemas/ai";
import type { ChatMessage } from "./chat-store";

/**
 * Chats on the server and the copies kept on this phone. The phone's copy is richer
 * (Undo, drafts waiting for a tap, steps), the server's is on every device; these
 * decide what to show when both exist. Pure, so it can be tested.
 */

/** One message as GET /ai/threads/:id returns it. */
export interface ServerMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  memo: string | null;
  cards: AssistantCard[];
  actions: { summary: string }[];
  rating: AssistantRating | null;
  /** Tiki's question as a small form; older servers leave it out. */
  question?: AssistantQuestion | null;
  createdAt: number;
}

/** One chat in a list: GET /ai/threads, or a chat kept on this phone. */
export interface ThreadSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
}

/** A chat kept on this phone; `synced` once any of it is on the server. */
export interface LocalThread extends ThreadSummary {
  synced: boolean;
}

/** A row in the chat list; `local` when only this phone has it so far. */
export interface ThreadRow extends ThreadSummary {
  local: boolean;
}

const TITLE_LENGTH = 60;

/** A chat's name from its first message, one line, as the server makes it. */
export function threadTitle(messages: readonly ChatMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.content ?? "";
  const line = first.replace(/\s+/g, " ").trim();
  if (line.length <= TITLE_LENGTH) return line || "New chat";
  const cut = line.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return (space > TITLE_LENGTH / 2 ? cut.slice(0, space) : cut).trim();
}

/** The server's messages as chat messages: what was done is listed, without Undo. */
export function fromServer(messages: readonly ServerMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    id: message.id,
    serverId: message.id,
    role: message.role,
    content: message.content,
    ...(message.memo ? { memo: message.memo } : {}),
    ...(message.cards.length ? { cards: message.cards } : {}),
    ...(message.actions.length ? { actions: message.actions } : {}),
    ...(message.rating ? { rating: message.rating } : {}),
    ...(message.question ? { question: message.question } : {}),
    at: message.createdAt,
  }));
}

/**
 * The chat to show when the phone has a copy and the server answered. The phone's
 * messages stay as they are (their Undo and drafts only live here); messages the
 * server has after the last reply both know of (written on another device) are
 * added. Ratings follow the server. If nothing lines up, the server's copy wins
 * unless the phone's was never stored, which only this phone has.
 */
export function mergeThread(
  local: readonly ChatMessage[],
  server: readonly ServerMessage[],
): ChatMessage[] {
  const remote = fromServer(server);
  if (local.length === 0) return remote;
  const position = new Map(server.map((message, index) => [message.id, index]));
  const rating = new Map(server.map((message) => [message.id, message.rating]));
  const kept = local.map((message) => {
    if (!message.serverId || !rating.has(message.serverId)) return message;
    const { rating: _old, ...rest } = message;
    const now = rating.get(message.serverId);
    return now ? { ...rest, rating: now } : rest;
  });

  let localAt = -1;
  for (let i = kept.length - 1; i >= 0 && localAt === -1; i--) {
    const id = kept[i]?.serverId;
    if (id && position.has(id)) localAt = i;
  }
  if (localAt === -1) return kept.some((message) => message.serverId) ? remote : kept;

  const serverAt = position.get(kept[localAt]?.serverId ?? "") ?? -1;
  const tail = kept.slice(localAt + 1);
  // The server keeps the question of a turn that failed here; the phone shows it already.
  const shown = tail.filter((message) => message.role === "user").map((m) => m.content);
  const fresh = remote.slice(serverAt + 1).filter((message) => {
    if (message.role !== "user") return true;
    const index = shown.indexOf(message.content);
    if (index === -1) return true;
    shown.splice(index, 1);
    return false;
  });
  if (!fresh.some((message) => message.role === "assistant")) return kept;
  return [...kept.slice(0, localAt + 1), ...[...tail, ...fresh].sort((a, b) => a.at - b.at)];
}

/**
 * The chat list: the server's, plus chats only this phone has (written offline and
 * never sent). A chat this phone once synced that the server no longer lists was
 * deleted elsewhere, so it isn't shown. Newest first. Offline (`server` undefined),
 * the phone's own copies are the list.
 */
export function threadList(
  server: readonly ThreadSummary[] | undefined,
  local: readonly LocalThread[],
): ThreadRow[] {
  const rows = new Map<string, ThreadRow>();
  for (const thread of server ?? []) rows.set(thread.id, { ...thread, local: false });
  for (const thread of local) {
    if (thread.messageCount === 0) continue;
    const listed = rows.get(thread.id);
    if (listed) {
      // Messages written here since the list was fetched.
      rows.set(thread.id, {
        ...listed,
        updatedAt: Math.max(listed.updatedAt, thread.updatedAt),
        messageCount: Math.max(listed.messageCount, thread.messageCount),
      });
    } else if (!server || !thread.synced) {
      const { synced, ...summary } = thread;
      rows.set(thread.id, { ...summary, local: !synced });
    }
  }
  return [...rows.values()].sort((a, b) =>
    b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : b.id < a.id ? -1 : 1,
  );
}

const ASKS_ENGLISH =
  /\b(go ahead|shall i|should i|want me to|proceed|confirm|do (it|that)|ok|okay|sound good)\b/i;
const ASKS_BANGLA = /(করব|দেব|দিব|ঠিক আছে)/;

/**
 * Whether Tiki's reply ends by asking the user to agree before it acts ("I'll move
 * 7 tasks to Friday. Go ahead?"), so the chat can offer a one-tap yes or no.
 */
export function asksToGoAhead(reply: string): boolean {
  const end =
    reply
      .trim()
      .split(/(?<=[.!?।])\s+/)
      .at(-1) ?? "";
  return end.endsWith("?") && (ASKS_ENGLISH.test(end) || ASKS_BANGLA.test(end));
}
