import { clockLabel } from "@/components/ui/picker-options";
import { formatClock, formatWhen, plural } from "@/lib/format";

/**
 * The one line shown before Android's notification prompt, saying what the reminder
 * just set up will do. Short, and about this reminder only.
 */

export function whyTask(at: number, now: number, timeZone: string): string {
  const day = formatWhen(at, false, now, timeZone);
  const clock = formatClock(at, timeZone);
  const when =
    day === "Today"
      ? `at ${clock}`
      : day === "Tomorrow"
        ? `tomorrow at ${clock}`
        : `on ${day} at ${clock}`;
  return `Tick & Taka can remind you ${when}.`;
}

export function whyRecurring(kind: "bill" | "income", remindDays: number): string {
  const day = kind === "bill" ? "the day it's due" : "the day it's expected";
  const early = remindDays > 0 ? `${plural(remindDays, "day")} before and on ` : "on ";
  return `Tick & Taka can remind you ${early}${day}, at ${clockLabel("09:00")}.`;
}

export function whyHabit(remindAt: string): string {
  return `Tick & Taka can nudge you at ${clockLabel(remindAt)}.`;
}

export const WHY_DEBT = "Tick & Taka can remind you about this loan on the day you picked.";

export function whyShutdown(time: string): string {
  return `Tick & Taka can remind you to close the day at ${clockLabel(time)}.`;
}

export function whyWeeklyReview(day: string, time: string): string {
  return `Tick & Taka can remind you every ${day} at ${clockLabel(time)}.`;
}
