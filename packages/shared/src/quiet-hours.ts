/**
 * Quiet hours (default 23:00–07:00): anything scheduled inside the window waits
 * until the window ends.
 */

import { DEFAULT_TIME_ZONE, localParts, zonedTimeToUtc } from "./dates";

export interface QuietHours {
  start: string; // HH:MM
  end: string; // HH:MM
}

const toMinutes = (clock: string) => {
  const [h, m] = clock.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export function isInQuietHours(
  ms: number,
  quiet: QuietHours,
  timeZone: string = DEFAULT_TIME_ZONE,
): boolean {
  const { hour, minute } = localParts(ms, timeZone);
  const now = hour * 60 + minute;
  const start = toMinutes(quiet.start);
  const end = toMinutes(quiet.end);
  if (start === end) return false;
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Moves an instant out of quiet hours to the moment they end. */
export function deferPastQuietHours(
  ms: number,
  quiet: QuietHours,
  timeZone: string = DEFAULT_TIME_ZONE,
): number {
  if (!isInQuietHours(ms, quiet, timeZone)) return ms;
  const end = toMinutes(quiet.end);
  const p = localParts(ms, timeZone);
  let candidate = zonedTimeToUtc(
    { year: p.year, month: p.month, day: p.day, hour: Math.floor(end / 60), minute: end % 60 },
    timeZone,
  );
  if (candidate <= ms)
    candidate = zonedTimeToUtc(
      {
        year: p.year,
        month: p.month,
        day: p.day + 1,
        hour: Math.floor(end / 60),
        minute: end % 60,
      },
      timeZone,
    );
  return candidate;
}
