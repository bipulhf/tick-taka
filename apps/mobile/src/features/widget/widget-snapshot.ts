import { addDays, lastDayOfMonth, startOfLocalDay } from "@tick-taka/shared/dates";
import { formatAmount, hiddenAmount } from "@tick-taka/shared/money";
import type { TodayData } from "@/lib/queries";
import type {
  WidgetBill,
  WidgetCache,
  WidgetFocus,
  WidgetHabit,
  WidgetMonth,
  WidgetTask,
} from "./widget-cache";
import { billOrder } from "./widget-model";

/**
 * The widgets' numbers and lists, built from what the app already fetched. Pure, so
 * each is tested. Every builder takes only the fields it reads.
 */

const OPEN = new Set(["inbox", "open"]);
const SHOWN = new Set(["inbox", "open", "done"]);
/** Bills kept beyond the three shown, so paying one brings the next up. */
const BILLS_KEPT = 6;
const EARLIER_KEPT = 20;

interface TaskLike {
  id: string;
  title: string;
  status: string;
  doAt: number | null;
  hasTime: boolean;
  parentId?: string | null;
}

function widgetTask(task: TaskLike, top: boolean): WidgetTask {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    done: task.status === "done",
    at: task.hasTime ? task.doAt : null,
    doAt: task.doAt,
    top,
  };
}

/** Today's tasks for the widgets: the top three first, then the day in order, then evening. */
export function todayTasks(data: {
  topThree: TaskLike[];
  timeline: TodayData["timeline"] | { kind: string; task?: TaskLike }[];
  evening?: TaskLike[];
}): WidgetTask[] {
  const seen = new Set<string>();
  const out: WidgetTask[] = [];
  const add = (task: TaskLike, top: boolean) => {
    if (seen.has(task.id) || !SHOWN.has(task.status)) return;
    seen.add(task.id);
    out.push(widgetTask(task, top));
  };
  for (const task of data.topThree) add(task, true);
  for (const item of data.timeline as { kind: string; task?: TaskLike }[])
    if (item.kind === "task" && item.task) add(item.task, false);
  for (const task of data.evening ?? []) add(task, false);
  return out;
}

/**
 * Open tasks from earlier days (oldest first) and how many wait for tomorrow, from a
 * list of open tasks planned before the day after tomorrow.
 */
export function otherDays(
  open: TaskLike[],
  date: string,
  timeZone: string,
): { earlier: WidgetTask[]; tomorrowCount: number } {
  const today = startOfLocalDay(date, timeZone);
  const tomorrow = startOfLocalDay(addDays(date, 1), timeZone);
  const after = startOfLocalDay(addDays(date, 2), timeZone);
  const live = open.filter((task) => OPEN.has(task.status) && !task.parentId);
  const earlier = live
    .filter((task) => task.doAt !== null && task.doAt < today)
    .sort((a, b) => (a.doAt ?? 0) - (b.doAt ?? 0))
    .slice(0, EARLIER_KEPT)
    .map((task) => widgetTask(task, false));
  const tomorrowCount = live.filter(
    (task) => task.doAt !== null && task.doAt >= tomorrow && task.doAt < after,
  ).length;
  return { earlier, tomorrowCount };
}

export function widgetHabits(
  habits: {
    id: string;
    name: string;
    emoji: string;
    todayCount: number;
    targetCount: number;
    streak: { current: number };
  }[],
): WidgetHabit[] {
  return habits.map((habit) => ({
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    count: habit.todayCount,
    target: habit.targetCount,
    streak: habit.streak.current,
  }));
}

/**
 * Bills to pay (overdue first) and income due by today, and what's still to pay this
 * month in the main currency: every bill due by the month's last day, late ones too.
 */
export function widgetBills(
  recurring: {
    id: string;
    name: string;
    kind: string;
    amountMinor: number;
    currency: string;
    accountId: string | null;
    nextDueAt: number;
    dueDate: string;
  }[],
  date: string,
  currency: string,
): { bills: WidgetBill[]; billsLeftMinor: number } {
  const monthEnd = lastDayOfMonth(date.slice(0, 7));
  const all: WidgetBill[] = recurring
    .filter((item) => item.kind === "bill" || item.dueDate <= date)
    .map((item) => {
      const income = item.kind !== "bill";
      return {
        id: item.id,
        name: item.name,
        income,
        amountMinor: item.amountMinor,
        currency: item.currency,
        accountId: item.accountId,
        dueDate: item.dueDate,
        dueAt: item.nextDueAt,
        overdue: item.dueDate < date,
        thisMonth: !income && item.dueDate <= monthEnd,
      };
    });
  const billsLeftMinor = all
    .filter((bill) => bill.thisMonth && bill.currency === currency)
    .reduce((sum, bill) => sum + bill.amountMinor, 0);
  return { bills: [...all].sort(billOrder).slice(0, BILLS_KEPT), billsLeftMinor };
}

/** This month: money in and out, how much of the budgets is used, and the top category. */
export function widgetMonth(
  month: string,
  insights: { totals: { incomeMinor: number; spentMinor: number } } | undefined,
  budgets:
    | {
        lines: { parentId: string | null; name: string; emoji: string; spentMinor: number }[];
        buckets: Record<string, { limitMinor: number; spentMinor: number }>;
      }
    | undefined,
  previous: WidgetMonth | null,
): WidgetMonth | null {
  if (!insights && !budgets) return previous?.month === month ? previous : null;
  const same = previous?.month === month ? previous : null;
  const buckets = budgets ? Object.values(budgets.buckets).filter((b) => b.limitMinor > 0) : [];
  const top = budgets?.lines
    .filter((line) => line.parentId === null && line.spentMinor > 0)
    .sort((a, b) => b.spentMinor - a.spentMinor)[0];
  return {
    month,
    inMinor: insights?.totals.incomeMinor ?? same?.inMinor ?? 0,
    outMinor: insights?.totals.spentMinor ?? same?.outMinor ?? 0,
    budgetLimitMinor: budgets
      ? buckets.reduce((sum, b) => sum + b.limitMinor, 0)
      : (same?.budgetLimitMinor ?? 0),
    budgetSpentMinor: budgets
      ? buckets.reduce((sum, b) => sum + b.spentMinor, 0)
      : (same?.budgetSpentMinor ?? 0),
    top: budgets
      ? top
        ? { name: top.name, emoji: top.emoji, amountMinor: top.spentMinor }
        : null
      : (same?.top ?? null),
  };
}

/**
 * The focus session running now, from the server's running timer. A session started
 * on the widget after these numbers were fetched isn't on the server's list yet, so it
 * stands until it ends.
 */
export function widgetFocus(
  running: { id: string; startedAt: number; source: string; taskId: string | null } | null,
  input: {
    minutes: number;
    tasks: WidgetTask[];
    previous: WidgetFocus | null;
    /** When the server's answer was fetched (ms). */
    fetchedAt: number;
    now: number;
  },
): WidgetFocus | null {
  const { minutes, tasks, previous, fetchedAt, now } = input;
  if (running?.source === "focus") {
    if (previous?.entryId === running.id) return previous;
    return {
      entryId: running.id,
      startedAt: running.startedAt,
      endsAt: running.startedAt + minutes * 60_000,
      taskId: running.taskId,
      title: tasks.find((task) => task.id === running.taskId)?.title ?? null,
    };
  }
  if (previous && previous.startedAt > fetchedAt && previous.endsAt > now) return previous;
  return null;
}

/**
 * Whether the widget offers Tiki: only when the server's AI is set up and the chat
 * is on, as in the app's tab bar. While the status hasn't loaded, the last answer stands.
 */
export function widgetAssistant(
  ai: { configured: boolean; features: { assistant: boolean } } | undefined,
  previous: boolean,
): boolean {
  return ai ? ai.configured && ai.features.assistant : previous;
}

/** How the widget writes an amount: in the user's digits, or masked while Hide amounts is on. */
export function widgetMoney(cache: Pick<WidgetCache, "numerals" | "hidden">) {
  return (minor: number) =>
    cache.hidden ? hiddenAmount() : formatAmount(minor, { numerals: cache.numerals });
}
