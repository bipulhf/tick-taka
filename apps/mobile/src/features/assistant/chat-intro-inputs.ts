import type { BriefingDue, BriefingInput } from "@tick-taka/shared/tiki-briefing";
import type { SuggestionInput } from "@tick-taka/shared/tiki-suggestions";

/**
 * The numbers the chat's briefing and suggestion chips are picked from, out of the
 * Today data the phone already has (cached, so they work offline). Pure, so it can
 * be tested.
 */

interface TaskLike {
  id: string;
  status: string;
}

interface DueLike {
  name: string;
  /** "bill" or "income" for a recurring item. */
  kind: string;
  dueDate: string;
  status?: string;
}

/** The parts of GET /today these read. */
export interface DayLike {
  date: string;
  tomorrow: string;
  topThree: TaskLike[];
  evening: TaskLike[];
  timeline: (
    | { kind: "task"; task: TaskLike }
    | { kind: "bill" | "payday"; name: string; dueDate: string }
    | { kind: string }
  )[];
  upcoming: DueLike[];
  habits: { doneToday: boolean; schedule: string; perWeek: number | null; weekDoneDays: number }[];
  safeToSpend: { hasBudgets: boolean; leftTodayMinor: number };
  counts: { overdue: number; inbox: number };
}

const open = (task: TaskLike) => task.status === "open" || task.status === "inbox";

/** Open tasks planned for today, top three included, each counted once. */
function tasksLeft(day: DayLike): number {
  const ids = new Set<string>();
  for (const item of day.timeline)
    if (item.kind === "task" && "task" in item && open(item.task)) ids.add(item.task.id);
  for (const task of [...day.evening, ...day.topThree]) if (open(task)) ids.add(task.id);
  return ids.size;
}

/** Habits still to check in today; a weekly target already met is done for the week. */
function habitsLeft(day: DayLike): number {
  return day.habits.filter((habit) => {
    if (habit.doneToday) return false;
    if (habit.schedule === "weekly") return habit.weekDoneDays < 1;
    if (habit.schedule === "n_per_week") return habit.weekDoneDays < (habit.perWeek ?? 1);
    return true;
  }).length;
}

/** Bills and paydays due today (from the timeline) or tomorrow (from what's coming up). */
function dueSoon(day: DayLike): BriefingDue[] {
  const due: BriefingDue[] = [];
  for (const item of day.timeline)
    if ((item.kind === "bill" || item.kind === "payday") && "dueDate" in item)
      if (item.dueDate === day.date)
        // A late bill also sits on today's timeline; it isn't "due today".
        due.push({ name: item.name, kind: item.kind === "bill" ? "bill" : "income", day: "today" });
  for (const item of day.upcoming)
    if (item.dueDate === day.tomorrow)
      due.push({
        name: item.name,
        kind: item.kind === "bill" ? "bill" : "income",
        day: "tomorrow",
      });
  return due;
}

export function briefingInput(day: DayLike, hour: number): BriefingInput {
  return {
    hour,
    tasksLeft: tasksLeft(day),
    topThreeLeft: day.topThree.filter(open).length,
    safeToSpendMinor: day.safeToSpend.hasBudgets ? day.safeToSpend.leftTodayMinor : null,
    due: dueSoon(day),
    habitsLeft: habitsLeft(day),
  };
}

export function suggestionInput(
  day: DayLike | undefined,
  view: string,
  hour: number,
  hasAccounts: boolean,
): SuggestionInput {
  // Bills on today's timeline (late ones too) and those coming up within their reminder days.
  const billsDueSoon = day
    ? day.timeline.filter((item) => item.kind === "bill").length +
      day.upcoming.filter((item) => item.kind === "bill" && item.status === "due_soon").length
    : 0;
  return {
    view,
    hour,
    overdue: day?.counts.overdue ?? 0,
    inbox: day?.counts.inbox ?? 0,
    topThreeLeft: day ? day.topThree.filter(open).length : 0,
    billsDueSoon,
    hasAccounts,
    hasBudgets: day?.safeToSpend.hasBudgets ?? false,
  };
}
