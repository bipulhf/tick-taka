import {
  addDays,
  daysInMonth,
  firstDayOfMonth,
  startOfWeek,
  weekdayOf,
} from "@tick-taka/shared/dates";

/** The spending calendar's grid. Pure, so it can be tested. */

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const LONG_WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Column headings from the user's first weekday: short letter and full name. */
export function weekdayHeadings(weekStartsOn: number): { short: string; long: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const day = (weekStartsOn + i) % 7;
    return { short: WEEKDAYS[day] ?? "", long: LONG_WEEKDAYS[day] ?? "" };
  });
}

/** Every day the month's grid shows, whole weeks from the first weekday on. */
export function monthCells(month: string, weekStartsOn: number): string[] {
  const first = firstDayOfMonth(month);
  const leading = (weekdayOf(first) - weekStartsOn + 7) % 7;
  const count = Math.ceil((leading + daysInMonth(month)) / 7) * 7;
  const start = startOfWeek(first, weekStartsOn);
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

/**
 * The width of a day's spend bar, as a share of the month's biggest day: at least a
 * fifth, so a small day still shows a mark; none for a day without spending.
 */
export function spendBarPercent(spentMinor: number, maxMinor: number): number {
  if (spentMinor <= 0) return 0;
  return Math.max(20, Math.min(100, (spentMinor / Math.max(1, maxMinor)) * 100));
}

/** The day an arrow key moves to: a day left or right, a week up or down. */
export function stepDay(date: string, key: string): string | null {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
  return step === undefined ? null : addDays(date, step);
}
