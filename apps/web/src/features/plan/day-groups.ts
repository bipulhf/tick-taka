import { toLocalDate } from "@tick-taka/shared/dates";
import { formatLocalDate } from "@/lib/format";

/** Tasks grouped by local day, and the timesheet the logbook shares. Pure, so it can be tested. */

/** Upcoming tasks by the local day they are planned for, in date order. */
export function groupByDay<T extends { doAt: number | null }>(
  tasks: T[],
  timeZone: string,
): [string, T[]][] {
  const byDay = new Map<string, T[]>();
  for (const task of tasks) {
    if (task.doAt === null) continue;
    const day = toLocalDate(task.doAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
}

interface Done {
  title: string;
  doneAt: number | null;
}

/** Finished tasks by the local day they were finished, newest day first. */
export function doneByDay<T extends Done>(tasks: T[], timeZone: string): [string, T[]][] {
  const byDay = new Map<string, T[]>();
  for (const task of tasks) {
    if (task.doneAt === null) continue;
    const day = toLocalDate(task.doneAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([day, list]) => [day, [...list].sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))]);
}

/** "What I did for Job 1, week of Sat 24 Oct", then each day and its tasks, oldest first. */
export function timesheetText(
  days: [string, Done[]][],
  weekStart: string,
  areaName?: string,
): string {
  const lines = [...days]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([day, tasks]) =>
        `${formatLocalDate(day, "long")}\n${tasks.map((t) => `  • ${t.title}`).join("\n")}`,
    );
  return `What I did${areaName ? ` for ${areaName}` : ""}, week of ${formatLocalDate(weekStart)}\n\n${lines.join("\n\n")}`;
}
