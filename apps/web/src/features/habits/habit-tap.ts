/**
 * What a tap on a habit ring does. Below the target it counts one more; at the
 * target it changes nothing (a stray tap must never wipe a full day), and the
 * screen offers "Take one back" instead. Pure, so it can be tested.
 */
export type HabitTap = { kind: "count"; next: number } | { kind: "atTarget" };

export function habitTap(count: number, target: number): HabitTap {
  return count >= target ? { kind: "atTarget" } : { kind: "count", next: count + 1 };
}

/** One fewer, never below zero. */
export function takeOneBack(count: number): number {
  return Math.max(0, count - 1);
}
