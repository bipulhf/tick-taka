import { addDays, startOfWeek } from "@tick-taka/shared/dates";
import { plural } from "@/lib/format";

/**
 * "Reward, never guilt" (PRODUCT.md): progress is said by what was done, never by
 * what is missing. A zero streak invites a start; a week counts days done, not
 * days short. Pure.
 */

export type Schedule = "daily" | "weekly" | "n_per_week";

const SCHEDULE_LABEL = { daily: "Every day", weekly: "Once a week" } as const;

/** "Every day · 8 a day", "3 times a week". */
export function scheduleText(schedule: Schedule, perWeek: number | null, target: number): string {
  const base =
    schedule === "n_per_week" ? `${perWeek ?? 1} times a week` : SCHEDULE_LABEL[schedule];
  return target > 1 ? `${base} · ${target} a day` : base;
}

/** How many days a week the habit asks for. */
export function weekTarget(schedule: Schedule, perWeek: number | null): number {
  return schedule === "daily" ? 7 : schedule === "weekly" ? 1 : (perWeek ?? 1);
}

/** "best 5 days", or nothing until there is a best to speak of. */
export function bestText(best: number, unit = "day"): string | null {
  return best > 0 ? `best ${plural(best, unit)}` : null;
}

/** A habit's week by days done: "3 days this week"; "1 of 3 this week" for n-per-week. */
export function weekProgressText(done: number, target: number, daily: boolean): string {
  if (done === 0) return "A fresh week";
  return daily ? `${plural(done, "day")} this week` : `${done} of ${target} this week`;
}

export interface HistoryDay {
  date: string;
  count: number;
}

/**
 * The history grid: whole weeks (from the user's first weekday) ending with the
 * week holding `today`, each day with its count; days after today are left out.
 */
export function historyWeeks(
  logs: HistoryDay[],
  today: string,
  weeks: number,
  weekStartsOn: number,
): (HistoryDay | null)[][] {
  const counts = new Map(logs.map((log) => [log.date, log.count]));
  const first = addDays(startOfWeek(today, weekStartsOn), -7 * (weeks - 1));
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = addDays(first, w * 7 + d);
      return date > today ? null : { date, count: counts.get(date) ?? 0 };
    }),
  );
}
