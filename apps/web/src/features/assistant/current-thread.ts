import { newId } from "@tick-taka/shared/ids";
import { tokenStore } from "@/lib/auth";
import { createStore } from "@/lib/store";

const KEY = "tt.assistant-thread";

function read(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/**
 * The chat on screen, by its id on the server. Null for a new chat that has no
 * message yet: it gets its id with the first one, so empty chats never reach the list.
 */
export const threadIdStore = createStore<string | null>(read());

export function setThreadId(id: string | null) {
  threadIdStore.set(id);
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {}
}

/** The current chat's id, made now if this is its first message. */
export function threadIdForSend(): string {
  const current = threadIdStore.get();
  if (current) return current;
  const id = newId();
  setThreadId(id);
  return id;
}

tokenStore.subscribe(() => {
  if (!tokenStore.get()) setThreadId(null);
});

// Another tab switched chats: follow it, as the messages themselves do.
window.addEventListener("storage", (event) => {
  if (event.key === KEY) threadIdStore.set(read());
});
