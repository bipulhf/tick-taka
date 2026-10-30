import { tokenStore } from "@/lib/auth";
import { createStore } from "@/lib/store";
import { type FocusSession, parseSession } from "./focus-session";

const KEY = "tt.focus-session";

function read(): FocusSession | null {
  try {
    return parseSession(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** The running Pomodoro, persisted so it survives a reload or a closed tab. */
export const focusStore = createStore<FocusSession | null>(read());

export function setFocusSession(session: FocusSession | null) {
  focusStore.set(session);
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session));
    else localStorage.removeItem(KEY);
  } catch {}
}

// Someone else's session never carries over to the next person signing in.
tokenStore.subscribe(() => {
  if (!tokenStore.get()) setFocusSession(null);
});

// Another tab started, paused or stopped it: follow along.
window.addEventListener("storage", (event) => {
  if (event.key === KEY) focusStore.set(read());
});
