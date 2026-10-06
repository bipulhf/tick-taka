import { addDays, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";

/** Milliseconds from `now` until the next local midnight in `timeZone` (at least 1 s). */
export function msUntilNextLocalMidnight(now: number, timeZone: string): number {
  const tomorrow = addDays(toLocalDate(now, timeZone), 1);
  return Math.max(1000, startOfLocalDay(tomorrow, timeZone) - now);
}

/** How long to wait before checking the date again: midnight, or 5 minutes, whichever is first. */
export function nextDateCheckMs(now: number, timeZone: string): number {
  return Math.min(5 * 60_000, msUntilNextLocalMidnight(now, timeZone) + 500);
}

/**
 * The newest Today the cache holds, to show (marked as older) while the new day's
 * one loads or can't load offline.
 */
export function latestToday<T extends { date: string }>(cached: (T | undefined)[]): T | undefined {
  let latest: T | undefined;
  for (const data of cached) if (data && (!latest || data.date > latest.date)) latest = data;
  return latest;
}
