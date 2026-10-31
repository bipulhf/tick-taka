import { diffDays, type LocalDate, weekdayOf } from "./dates";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * The one weekly review day (Settings › Reminders, 0 = Sunday … 6 = Saturday). Today's
 * recap row, Review home's row and the reminder all follow it.
 */
export function isWeeklyReviewDay(date: LocalDate, weeklyReviewDay: number): boolean {
  return weekdayOf(date) === weeklyReviewDay;
}

/** "It's Friday, a good day for it": Review home's line on the review day. */
export function weeklyReviewHint(weeklyReviewDay: number): string {
  return `It's ${DAY_NAMES[weeklyReviewDay] ?? "review day"}, a good day for it`;
}

/** A week's focus shows this many days after it was saved, enough to reach the next review. */
export const WEEKLY_FOCUS_DAYS = 8;

/**
 * "Next week's focus" for Today's header, or null when there is none or it is older
 * than a week and a day (no review since). A focus saved before it was dated is
 * treated as old: its age can't be told.
 */
export function currentWeeklyFocus(
  settings: { weeklyFocus: string | null; weeklyFocusOn: LocalDate | null },
  today: LocalDate,
): string | null {
  const focus = settings.weeklyFocus?.trim();
  if (!focus || !settings.weeklyFocusOn) return null;
  return diffDays(settings.weeklyFocusOn, today) <= WEEKLY_FOCUS_DAYS ? focus : null;
}
