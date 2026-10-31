import { type LocalDate, weekdayOf } from "./dates";

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
