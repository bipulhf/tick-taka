import { showBrowserNotification } from "@/features/settings/browser-notifications";
import { playSound } from "@/lib/sounds";
import type { FocusSession } from "./focus-session";
import { focusStore } from "./focus-store";

/** The end of the phase already rung for, so the bell sounds once. */
let rungFor: string | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;

const keyOf = (session: FocusSession) => `${session.phase}:${session.endsAt}`;

/**
 * The bell when work ends (and a browser notification for either phase, when they
 * are on), once per phase, whether the focus page is open or not.
 */
export function ringEnd(session: FocusSession): void {
  if (rungFor === keyOf(session)) return;
  rungFor = keyOf(session);
  if (session.phase === "work") {
    playSound("focus");
    showBrowserNotification("focus", "Focus done 🌱", "Time for a short break.");
  } else showBrowserNotification("focus", "Break's over", "Ready for another round?");
}

/** Keeps a timer set for the running phase's end while this tab is open. */
function arm() {
  clearTimeout(timer);
  const session = focusStore.get();
  if (!session || session.pausedRemainingMs !== null) return;
  // A phase that ended while the tab was closed has nothing left to ring for.
  if (Date.now() - session.endsAt > 60_000) {
    rungFor = keyOf(session);
    return;
  }
  timer = setTimeout(() => ringEnd(session), Math.max(0, session.endsAt - Date.now()));
}

focusStore.subscribe(arm);
arm();
