import { daysLeftInMonth, weekdayOf } from "@tick-taka/shared/dates";
import type { PillStatus } from "@/components/ui/status-pill";

/**
 * Where each review ritual stands today, in a few calm words for Review's cards:
 * a state pill and the line under it. Never "late" or "missed"; a ritual is ready,
 * coming up or done. Pure.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface RitualState {
  status: PillStatus;
  label: string;
}

/** Tonight's shutdown, from where this tab's progress got to. */
export function shutdownState(
  progress: { step: number; finished: boolean } | null,
  steps: number,
): RitualState {
  if (progress?.finished) return { status: "done", label: "Done tonight" };
  if (progress && progress.step > 0)
    return {
      status: "due_soon",
      label: `Step ${Math.min(progress.step, steps - 1) + 1} of ${steps}`,
    };
  return { status: "upcoming", label: "Ready tonight" };
}

/** Days from `today` to the next weekly review day; 0 on the day itself. */
export function daysToReviewDay(today: string, reviewDay: number): number {
  return (((reviewDay - weekdayOf(today)) % 7) + 7) % 7;
}

/** "Today" on the review day, "Due tomorrow", else "Due Friday". */
export function weeklyState(today: string, reviewDay: number): RitualState {
  const days = daysToReviewDay(today, reviewDay);
  if (days === 0) return { status: "due_today", label: "Today" };
  if (days === 1) return { status: "due_soon", label: "Due tomorrow" };
  return { status: "upcoming", label: `Due ${DAY_NAMES[reviewDay] ?? "on review day"}` };
}

/** The month's close: "Ends today", "3 days left"; sky in the last five days. */
export function monthlyState(today: string): RitualState {
  const left = daysLeftInMonth(today);
  if (left <= 1) return { status: "due_today", label: "Ends today" };
  return { status: left <= 5 ? "due_soon" : "upcoming", label: `${left} days left` };
}
