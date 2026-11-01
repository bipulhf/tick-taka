import { newId } from "@tick-taka/shared/ids";
import type {
  AssistantCard,
  AssistantQuestion,
  AssistantRating,
} from "@tick-taka/shared/schemas/ai";
import type { HttpMethod } from "@/lib/api";
import { secureStorage } from "@/lib/secure-storage";
import { createStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";
import { keptMessages, type LocalThread, threadTitle } from "./chat-threads";
import type { ChatDraft } from "./money-drafts";

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
  /** Money changes Tiki proposed; each is saved only when the user taps Save. */
  drafts?: ChatDraft[];
  /** Records to open and totals, shown under the reply. */
  cards?: AssistantCard[];
  /** Tiki asked with a small form; it can be answered until a later message exists. */
  question?: AssistantQuestion;
  /** The message's id on the server, once it is stored there (a reply's is used for thumbs). */
  serverId?: string;
  rating?: AssistantRating;
  /** The request failed; kept on screen but never sent back as context. */
  failed?: boolean;
  /**
   * The stream dropped mid-turn: the server may have made changes the phone never
   * heard about between these server times. Cleared once they have been looked up.
   */
  recover?: { since: number; until: number };
  at: number;
}

/** Before chats were kept on the server, the phone had one chat under this key. */
const LEGACY_KEY = "tt.assistant-chat";
const CURRENT_KEY = "tt.assistant-thread";
const INDEX_KEY = "tt.assistant-threads";
const threadKey = (id: string) => `tt.assistant-thread.${id}`;
const KEEP = 60;
/** Chats kept on this phone to read offline; the server keeps them all. */
const KEEP_THREADS = 12;

/** The open chat's messages. */
export const chatStore = createStore<ChatMessage[]>([]);
/** The open chat's id (a ULID the phone makes); empty until loaded. */
export const threadIdStore = createStore("");
/** Chats kept on this phone, newest first. */
export const localThreadsStore = createStore<LocalThread[]>([]);

let loading: Promise<void> | null = null;
resetOnSignOut(() => {
  chatStore.set([]);
  threadIdStore.set("");
  localThreadsStore.set([]);
  loading = null;
});

// One write at a time, so an older copy never lands after a newer one.
let writes: Promise<unknown> = Promise.resolve();
const persist = (key: string, value: string | null) => {
  writes = writes
    .then(() =>
      value === null ? secureStorage.removeItem(key) : secureStorage.setItem(key, value),
    )
    .catch(() => {});
};

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await secureStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

/** Keeps a chat's messages on the phone and lists it, dropping the oldest past the limit. */
function writeThread(id: string, messages: ChatMessage[]) {
  persist(threadKey(id), JSON.stringify(messages));
  const others = localThreadsStore.get().filter((thread) => thread.id !== id);
  const entry: LocalThread = {
    id,
    title: threadTitle(messages),
    updatedAt: messages.at(-1)?.at ?? Date.now(),
    messageCount: messages.length,
    synced: messages.some((message) => message.serverId),
  };
  const sorted = [...(messages.length ? [entry] : []), ...others].sort(
    (a, b) => b.updatedAt - a.updatedAt,
  );
  const current = threadIdStore.get();
  const kept = sorted.filter((thread, i) => i < KEEP_THREADS || thread.id === current);
  for (const dropped of sorted) if (!kept.includes(dropped)) persist(threadKey(dropped.id), null);
  localThreadsStore.set(kept);
  persist(INDEX_KEY, JSON.stringify(kept));
}

function startThread(id: string, messages: ChatMessage[]) {
  threadIdStore.set(id);
  persist(CURRENT_KEY, id);
  save(messages);
}

/** Reads the open chat and the list of kept chats, once. */
export function loadChat(): Promise<void> {
  loading ??= (async () => {
    try {
      const [current, index] = await Promise.all([
        secureStorage.getItem(CURRENT_KEY),
        readJson<LocalThread[]>(INDEX_KEY),
      ]);
      if (Array.isArray(index)) localThreadsStore.set(index);
      if (current) {
        threadIdStore.set(current);
        chatStore.set(keptMessages(await readJson(threadKey(current))));
        return;
      }
      const legacy = await readJson(LEGACY_KEY);
      startThread(newId(), keptMessages(legacy));
      if (legacy) persist(LEGACY_KEY, null);
    } catch {
      // The storage key may be unreadable for a moment; the chat starts empty and
      // the next open tries again.
      loading = null;
      if (!threadIdStore.get()) threadIdStore.set(newId());
    }
  })();
  return loading;
}

/** The open chat's id, made now if there is none yet. */
export function currentThreadId(): string {
  if (!threadIdStore.get()) startThread(newId(), chatStore.get());
  return threadIdStore.get();
}

/** A chat kept on this phone, or null when it isn't (or can't be read now). */
export async function readLocalThread(id: string): Promise<ChatMessage[] | null> {
  if (id === threadIdStore.get()) return chatStore.get();
  return readJson(threadKey(id)).then(
    (raw) => (raw === null ? null : keptMessages(raw)),
    () => null,
  );
}

/** Opens a chat with these messages; the one open before stays kept. */
export function switchThread(id: string, messages: ChatMessage[]) {
  startThread(id, messages);
}

export function newChat() {
  startThread(newId(), []);
}

/** Keeps a chat that isn't open (Undo after deleting it). */
export function keepThread(id: string, messages: ChatMessage[]) {
  if (id === threadIdStore.get()) save(messages);
  else writeThread(id, messages.slice(-KEEP));
}

/** Drops this phone's copy of a chat (it was deleted). */
export function forgetThread(id: string) {
  persist(threadKey(id), null);
  const kept = localThreadsStore.get().filter((thread) => thread.id !== id);
  localThreadsStore.set(kept);
  persist(INDEX_KEY, JSON.stringify(kept));
}

function save(messages: ChatMessage[]) {
  const kept = messages.slice(-KEEP);
  chatStore.set(kept);
  writeThread(currentThreadId(), kept);
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

/** Replaces the open chat's messages (a fresher copy from the server). */
export function replaceMessages(messages: ChatMessage[]) {
  save(messages);
}
