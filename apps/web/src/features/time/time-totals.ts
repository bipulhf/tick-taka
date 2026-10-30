import { toLocalDate } from "@tick-taka/shared/dates";

/** The time view's sums. Pure, so it can be tested. */

interface Entry {
  areaId: string | null;
  startedAt: number;
  endedAt: number | null;
}

export const minutesOf = (entry: Entry, now: number) =>
  ((entry.endedAt ?? now) - entry.startedAt) / 60_000;

/** Minutes per area, the biggest first; `null` is "No area". */
export function minutesByArea(entries: Entry[], now: number): [string | null, number][] {
  const byArea = new Map<string | null, number>();
  for (const entry of entries)
    byArea.set(entry.areaId, (byArea.get(entry.areaId) ?? 0) + minutesOf(entry, now));
  return [...byArea.entries()].sort((a, b) => b[1] - a[1]);
}

/** Entries by the local day they started, newest day and newest entry first. */
export function entriesByDay<T extends Entry>(entries: T[], timeZone: string): [string, T[]][] {
  const byDay = new Map<string, T[]>();
  for (const entry of [...entries].sort((a, b) => b.startedAt - a.startedAt)) {
    const day = toLocalDate(entry.startedAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), entry]);
  }
  return [...byDay.entries()].sort(([a], [b]) => b.localeCompare(a));
}
