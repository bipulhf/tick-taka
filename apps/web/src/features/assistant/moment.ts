import { addDays } from "@tick-taka/shared/dates";
import type { Numerals } from "@tick-taka/shared/money";
import type { BriefingDue, BriefingInput } from "@tick-taka/shared/tiki-briefing";
import type { SuggestionInput } from "@tick-taka/shared/tiki-suggestions";

/**
 * Today's numbers turned into the inputs of Tiki's briefing and suggestion chips.
 * Shaped like GET /today, only the parts read here, so it can be tested.
 */

interface TaskLike {
  id: string;
  status: string;
}

type TimelineLike =
  | { kind: "task"; task: TaskLike }
  | { kind: "bill" | "payday"; name: string; dueDate: string }
  | { kind: "debt" };

export interface TodayLike {
  date: string;
  topThree: TaskLike[];
  timeline: TimelineLike[];
  evening: TaskLike[];
  /** Bills and paydays after today, soonest first. */
  upcoming: { kind: "bill" | "income"; name: string; dueDate: string }[];
  habits: { doneToday: boolean }[];
  safeToSpend: { hasBudgets: boolean; leftTodayMinor: number };
  counts: { overdue: number; inbox: number };
}

/** Bills "due soon" for the chips: today, overdue, or within this many days. */
const SOON_DAYS = 3;

const open = (task: TaskLike) => task.status === "inbox" || task.status === "open";

/** Open tasks planned for today, top three included, each once. */
function tasksLeft(today: TodayLike): number {
  const ids = new Set<string>();
  const tasks = [
    ...today.topThree,
    ...today.timeline.flatMap((item) => (item.kind === "task" ? [item.task] : [])),
    ...today.evening,
  ];
  for (const task of tasks) if (open(task)) ids.add(task.id);
  return ids.size;
}

const topThreeLeft = (today: TodayLike) => today.topThree.filter(open).length;

/** What is due today (or late) and tomorrow, bills and paydays, in Today's order. */
function dueItems(today: TodayLike): BriefingDue[] {
  const tomorrow = addDays(today.date, 1);
  const now = today.timeline.flatMap((item): BriefingDue[] =>
    item.kind === "bill" || item.kind === "payday"
      ? [{ name: item.name, kind: item.kind === "bill" ? "bill" : "income", day: "today" }]
      : [],
  );
  const next = today.upcoming
    .filter((item) => item.dueDate === tomorrow)
    .map((item): BriefingDue => ({ name: item.name, kind: item.kind, day: "tomorrow" }));
  return [...now, ...next];
}

export function briefingInput(
  today: TodayLike,
  hour: number,
  options: { currency?: string; numerals?: Numerals } = {},
): BriefingInput {
  return {
    hour,
    tasksLeft: tasksLeft(today),
    topThreeLeft: topThreeLeft(today),
    safeToSpendMinor: today.safeToSpend.hasBudgets ? today.safeToSpend.leftTodayMinor : null,
    due: dueItems(today),
    habitsLeft: today.habits.filter((habit) => !habit.doneToday).length,
    ...options,
  };
}

export function suggestionInput(
  today: TodayLike | undefined,
  view: string,
  hour: number,
  hasAccounts: boolean,
): SuggestionInput {
  if (!today)
    return {
      view,
      hour,
      overdue: 0,
      inbox: 0,
      topThreeLeft: 0,
      billsDueSoon: 0,
      hasAccounts,
      hasBudgets: false,
    };
  const soon = addDays(today.date, SOON_DAYS);
  const billsDueSoon =
    today.timeline.filter((item) => item.kind === "bill").length +
    today.upcoming.filter((item) => item.kind === "bill" && item.dueDate <= soon).length;
  return {
    view,
    hour,
    overdue: today.counts.overdue,
    inbox: today.counts.inbox,
    topThreeLeft: topThreeLeft(today),
    billsDueSoon,
    hasAccounts,
    hasBudgets: today.safeToSpend.hasBudgets,
  };
}
