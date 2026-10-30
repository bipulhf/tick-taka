import {
  addDays,
  daysInMonth,
  firstDayOfMonth,
  lastDayOfMonth,
  startOfWeek,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { nextOccurrence } from "@tick-taka/shared/recurrence";

/** The plan calendar's days and bill marks. Pure, so it can be tested. */

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Column headings from the user's first weekday. */
export function weekdayHeaders(weekStartsOn: number): { letter: string; name: string }[] {
  return Array.from({ length: 7 }, (_, i) => ({
    letter: LETTERS[(weekStartsOn + i) % 7] ?? "",
    name: NAMES[(weekStartsOn + i) % 7] ?? "",
  }));
}

/** Every day on the grid: whole weeks covering the month, or the week holding `selected`. */
export function calendarCells(
  mode: "month" | "week",
  month: string,
  selected: string,
  weekStartsOn: number,
): string[] {
  if (mode === "week") {
    const start = startOfWeek(selected, weekStartsOn);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }
  const first = firstDayOfMonth(month);
  const start = startOfWeek(first, weekStartsOn);
  const leading = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const count = Math.ceil((leading + daysInMonth(month)) / 7) * 7;
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export interface Occurring {
  dueDate: string;
  rrule: string;
}

/**
 * Bill and payday occurrences from each item's repeat rule, from its next due date up
 * to a week past the month (the grid shows a few days of the next one).
 */
export function occurrencesByDate<T extends Occurring>(
  items: T[],
  month: string,
): Map<string, T[]> {
  const byDate = new Map<string, T[]>();
  const end = addDays(lastDayOfMonth(month), 7);
  for (const item of items) {
    let date: string | null = item.dueDate;
    for (let i = 0; date && date <= end && i < 62; i++) {
      byDate.set(date, [...(byDate.get(date) ?? []), item]);
      date = nextOccurrence(item.rrule, item.dueDate, date);
    }
  }
  return byDate;
}
