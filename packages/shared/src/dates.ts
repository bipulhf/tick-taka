/**
 * Time helpers. Instants are UTC epoch milliseconds; "today" and "this month" are
 * local ideas expressed as `YYYY-MM-DD` and `YYYY-MM` strings in the user's time zone.
 */

export const DEFAULT_TIME_ZONE = "Asia/Dhaka";
/** 0 = Sunday … 6 = Saturday; weeks in Bangladesh start on Saturday. */
export const DEFAULT_WEEK_STARTS_ON = 6;
export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
export const MINUTE_MS = 60_000;

export type LocalDate = string; // YYYY-MM-DD
export type LocalMonth = string; // YYYY-MM

export interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

/** True for a zone this runtime's Intl can format in ("Asia/Dhaka", "UTC"); false for "Dhaka". */
export function isTimeZone(timeZone: string): boolean {
  if (formatterCache.has(timeZone)) return true;
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

/** The zone if it is usable, otherwise the default, so one bad value can't break date maths. */
export function safeTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isTimeZone(timeZone) ? timeZone : DEFAULT_TIME_ZONE;
}

const pad = (value: number, length = 2) => String(value).padStart(length, "0");

export function localParts(ms: number, timeZone: string = DEFAULT_TIME_ZONE): LocalParts {
  const parts = formatterFor(timeZone).formatToParts(new Date(ms));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const year = get("year");
  const month = get("month");
  const day = get("day");
  return {
    year,
    month,
    day,
    hour: get("hour") % 24,
    minute: get("minute"),
    second: get("second"),
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
  };
}

/** Offset of `timeZone` from UTC at the given instant, in milliseconds. */
export function timeZoneOffsetMs(ms: number, timeZone: string = DEFAULT_TIME_ZONE): number {
  const p = localParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** Converts a wall-clock time in `timeZone` to a UTC instant. */
export function zonedTimeToUtc(
  wall: { year: number; month: number; day: number; hour?: number; minute?: number },
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  const guess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour ?? 0, wall.minute ?? 0);
  const first = guess - timeZoneOffsetMs(guess, timeZone);
  const second = guess - timeZoneOffsetMs(first, timeZone);
  return second;
}

export function toLocalDate(ms: number, timeZone: string = DEFAULT_TIME_ZONE): LocalDate {
  const p = localParts(ms, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toLocalMonth(ms: number, timeZone: string = DEFAULT_TIME_ZONE): LocalMonth {
  return toLocalDate(ms, timeZone).slice(0, 7);
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_RE = /^(\d{4})-(\d{2})$/;

export function isLocalDate(value: string): value is LocalDate {
  const match = DATE_RE.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isLocalMonth(value: string): value is LocalMonth {
  const match = MONTH_RE.exec(value);
  return match !== null && Number(match[2]) >= 1 && Number(match[2]) <= 12;
}

export function parseLocalDate(date: LocalDate): { year: number; month: number; day: number } {
  const match = DATE_RE.exec(date);
  if (!match) throw new Error(`Invalid local date: ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function fromUtcDate(date: Date): LocalDate {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  const { year, month, day } = parseLocalDate(date);
  return fromUtcDate(new Date(Date.UTC(year, month - 1, day + days)));
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(date: LocalDate): number {
  const { year, month, day } = parseLocalDate(date);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function startOfWeek(date: LocalDate, weekStartsOn = 6): LocalDate {
  const offset = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

export function monthOf(date: LocalDate): LocalMonth {
  return date.slice(0, 7);
}

export function addMonths(month: LocalMonth, count: number): LocalMonth {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Invalid local month: ${month}`);
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + count, 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

export function daysInMonth(month: LocalMonth): number {
  const match = MONTH_RE.exec(month);
  if (!match) throw new Error(`Invalid local month: ${month}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]), 0)).getUTCDate();
}

export function firstDayOfMonth(month: LocalMonth): LocalDate {
  return `${month}-01`;
}

export function lastDayOfMonth(month: LocalMonth): LocalDate {
  return `${month}-${pad(daysInMonth(month))}`;
}

/** Days left in the month, counting `date` itself. */
export function daysLeftInMonth(date: LocalDate): number {
  const { day } = parseLocalDate(date);
  return daysInMonth(monthOf(date)) - day + 1;
}

export function startOfLocalDay(date: LocalDate, timeZone: string = DEFAULT_TIME_ZONE): number {
  return zonedTimeToUtc(parseLocalDate(date), timeZone);
}

/** Exclusive end of the local day (start of the next day). */
export function endOfLocalDay(date: LocalDate, timeZone: string = DEFAULT_TIME_ZONE): number {
  return startOfLocalDay(addDays(date, 1), timeZone);
}

export interface InstantRange {
  from: number;
  /** exclusive */
  to: number;
}

export function localDayRange(date: LocalDate, timeZone: string = DEFAULT_TIME_ZONE): InstantRange {
  return { from: startOfLocalDay(date, timeZone), to: endOfLocalDay(date, timeZone) };
}

export function localMonthRange(
  month: LocalMonth,
  timeZone: string = DEFAULT_TIME_ZONE,
): InstantRange {
  return {
    from: startOfLocalDay(firstDayOfMonth(month), timeZone),
    to: startOfLocalDay(firstDayOfMonth(addMonths(month, 1)), timeZone),
  };
}

/** Inclusive list of local dates between two dates. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const days: LocalDate[] = [];
  for (let current = from; current <= to; current = addDays(current, 1)) days.push(current);
  return days;
}

/** Wall-clock minutes since local midnight. */
export function localMinuteOfDay(ms: number, timeZone: string = DEFAULT_TIME_ZONE): number {
  const p = localParts(ms, timeZone);
  return p.hour * 60 + p.minute;
}
