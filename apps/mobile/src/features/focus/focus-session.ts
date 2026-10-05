import AsyncStorage from "@react-native-async-storage/async-storage";
import { createStore } from "@/lib/store";
import { resetOnSignOut } from "@/lib/user-data";

export type FocusPhase = "work" | "break";

export interface FocusSession {
  phase: FocusPhase;
  startedAt: number;
  endsAt: number;
  taskId: string | null;
  entryId: string | null;
  /** Set when the app went to the background mid-session. */
  leftAt: number | null;
  drooping: boolean;
}

const KEY = "tt.focus-session";

/** The running Pomodoro, persisted so it survives the app being closed. */
export const focusStore = createStore<FocusSession | null>(null);
resetOnSignOut(() => focusStore.set(null));

export async function loadFocusSession() {
  const raw = await AsyncStorage.getItem(KEY);
  focusStore.set(raw ? (JSON.parse(raw) as FocusSession) : null);
}

export function setFocusSession(session: FocusSession | null) {
  focusStore.set(session);
  void (session
    ? AsyncStorage.setItem(KEY, JSON.stringify(session))
    : AsyncStorage.removeItem(KEY));
}

/** Coming back within a minute revives the plant. */
export const REVIVE_WINDOW_MS = 60_000;
