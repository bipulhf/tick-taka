import { isLocalDate, type LocalDate, parseLocalDate } from "@tick-taka/shared/dates";
import { formatLocalDate } from "@/lib/format";

/**
 * The calendar works in the browser's Date; the app works in "YYYY-MM-DD". A day is
 * built at local noon, so no zone offset (Dhaka's +6, a trip's -5) can tip it into
 * the day before or after. Pure, so it can be tested.
 */
export function dateFromLocal(date: LocalDate): Date | undefined {
  if (!isLocalDate(date)) return undefined;
  const { year, month, day } = parseLocalDate(date);
  return new Date(year, month - 1, day, 12);
}

/** The day a calendar Date shows, read in the browser's own zone like the grid draws it. */
export function localFromDate(date: Date): LocalDate {
  const y = String(date.getFullYear()).padStart(4, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** The field's text: "Mon 5 Oct", with the year only when it isn't this year's. */
export function dateFieldLabel(date: LocalDate, today: LocalDate): string {
  const label = formatLocalDate(date);
  return date.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${date.slice(0, 4)}`;
}

/** Whether a day may be picked, given the field's optional bounds. */
export function withinBounds(date: LocalDate, min?: string, max?: string): boolean {
  return (!min || date >= min) && (!max || date <= max);
}
