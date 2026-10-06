const STEP_MS = 5 * 60_000;

/**
 * What a screen reader hears during a focus session. `key` changes only at milestones
 * (a phase change, each five-minute mark, the last minute), so the screen announces
 * `text` when the key changes instead of reading the clock every second.
 */
export function focusAnnouncement(phase: "work" | "break" | null, remainingMs: number) {
  if (!phase) return null;
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  const bucket = remainingMs <= 60_000 ? "last" : String(Math.ceil(remainingMs / STEP_MS));
  return {
    key: `${phase}:${bucket}`,
    text: `${phase === "work" ? "Focus" : "Break"}, ${minutes} ${minutes === 1 ? "minute" : "minutes"} left`,
  };
}
