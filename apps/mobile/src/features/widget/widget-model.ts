import { addDays, daysInMonth, toLocalDate } from "@tick-taka/shared/dates";
import { payAccount } from "@/features/money/pay-account";
import { payNeedsRate } from "@/features/today/pay-needs-rate";
import { formatClock, formatLocalDate } from "@/lib/format";
import type { WidgetBill, WidgetCache, WidgetTask } from "./widget-cache";

/**
 * What each widget shows, chosen from the cache. Pure, so every choice is tested
 * (test/widget-model.test.ts); the widgets only draw what these return.
 */

/** Overdue first, then by due date. */
export function billOrder(a: WidgetBill, b: WidgetBill): number {
  if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
  return a.dueAt - b.dueAt;
}

/** "3 of 5 done" for today. */
export function doneOf(tasks: WidgetTask[]): { done: number; total: number } {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}

/**
 * The Today widget's list: the top three as picked (ticked ones too, so progress
 * shows), or with no top three, the first open tasks of the day.
 */
export function todayRows(tasks: WidgetTask[], count: number): WidgetTask[] {
  const top = tasks.filter((task) => task.top);
  return (top.length ? top : tasks.filter((task) => !task.done)).slice(0, count);
}

const RECENT_MS = 30 * 60_000;

/**
 * The Next card: the next timed task not already listed (one that started in the last
 * half hour still counts), else the first open task not listed.
 */
export function nextTask(
  tasks: WidgetTask[],
  listed: WidgetTask[],
  now: number,
): WidgetTask | null {
  const shown = new Set(listed.map((task) => task.id));
  const open = tasks.filter((task) => !task.done && !shown.has(task.id));
  const timed = open
    .filter((task) => task.at !== null && task.at >= now - RECENT_MS)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))[0];
  return timed ?? open.find((task) => task.at === null) ?? null;
}

/** "Next · 10:00 am" or "Next". */
export function nextLabel(task: WidgetTask, timeZone: string): string {
  return task.at === null ? "Next" : `Next · ${formatClock(task.at, timeZone)}`;
}

/** Days left in the month, today included ("30 days left" on 1 Nov). */
export function daysLeft(date: string): number {
  return daysInMonth(date.slice(0, 7)) - Number(date.slice(8, 10)) + 1;
}

/** The day of the month, for "day 1". */
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10));
}

/** "Sun 1 Nov" for the widget's header, or nothing before the first sync. */
export function headerDate(date: string): string {
  return date ? formatLocalDate(date) : "";
}

/**
 * When an earlier task was planned, in a short word for the list's right edge: the
 * weekday within the last week ("Thu"), else the date ("12 Oct").
 */
export function earlierLabel(task: WidgetTask, date: string, timeZone: string): string {
  if (task.doAt === null) return "";
  const day = toLocalDate(task.doAt, timeZone);
  const full = formatLocalDate(day);
  return day >= addDays(date, -6) ? full.slice(0, 3) : full.slice(4);
}

export type TaskListRow =
  | { kind: "heading"; key: string; text: string; tone: "earlier" | "today" }
  | { kind: "task"; key: string; task: WidgetTask; note: string; timed: boolean }
  | { kind: "empty"; key: string; text: string };

/** The Tasks list widget: earlier days' open tasks, then today's. */
export function taskListRows(
  cache: Pick<WidgetCache, "tasks" | "earlier" | "date" | "timeZone">,
): TaskListRow[] {
  const rows: TaskListRow[] = [];
  if (cache.earlier.length) {
    rows.push({
      kind: "heading",
      key: "earlier",
      text: `Earlier · ${cache.earlier.length}`,
      tone: "earlier",
    });
    for (const task of cache.earlier)
      rows.push({
        kind: "task",
        key: task.id,
        task,
        note: earlierLabel(task, cache.date, cache.timeZone),
        timed: false,
      });
  }
  rows.push({
    kind: "heading",
    key: "today",
    text: `Today · ${cache.tasks.length}`,
    tone: "today",
  });
  if (cache.tasks.length === 0)
    rows.push({ kind: "empty", key: "none", text: "Nothing planned today. Enjoy it." });
  for (const task of cache.tasks)
    rows.push({
      kind: "task",
      key: task.id,
      task,
      note: task.at === null ? "" : formatClock(task.at, cache.timeZone),
      timed: task.at !== null,
    });
  return rows;
}

/** The income due today (or late) to name in the Bills header, if any. */
export function incomeDue(bills: WidgetBill[]): WidgetBill | null {
  return bills.find((bill) => bill.income) ?? null;
}

/** Under a bill's name: "Was due Wed 28 Oct", "Due today · bKash", "Tue 3 Nov · Cash". */
export function billNote(
  bill: WidgetBill,
  date: string,
  accounts: WidgetCache["accounts"],
  defaultAccountId: string | null,
): string {
  if (bill.overdue) return `Was due ${formatLocalDate(bill.dueDate)}`;
  const when =
    bill.dueDate === date ? (bill.income ? "Today" : "Due today") : formatLocalDate(bill.dueDate);
  const account = accounts?.find((a) => a.id === (bill.accountId ?? defaultAccountId));
  return account ? `${when} · ${account.name}` : when;
}

/**
 * What "Paid" or "Received" does from the home screen: pay through the bill's own
 * account or the default, or open the app where it can ask (which account, a foreign
 * currency's rate, or adding a first account).
 */
export type BillTap =
  | { kind: "pay"; accountId: string | undefined; remember: boolean }
  | { kind: "open"; uri: string };

export function billTap(
  bill: WidgetBill,
  cache: Pick<WidgetCache, "accounts" | "accountId" | "currency">,
): BillTap {
  const accounts = cache.accounts ?? undefined;
  const from = payAccount({
    billAccountId: bill.accountId,
    defaultAccountId: cache.accountId,
    accounts,
  });
  if (from.kind === "add-account") return { kind: "open", uri: "ticktaka://account/new" };
  if (from.kind === "pick")
    return { kind: "open", uri: `ticktaka://money/recurring/${bill.id}?pay=account` };
  const needsRate = payNeedsRate({ ...bill, accountId: from.accountId ?? null }, accounts, {
    defaultAccountId: cache.accountId,
    defaultCurrency: cache.currency,
  });
  if (needsRate) return { kind: "open", uri: `ticktaka://money/recurring/${bill.id}` };
  return from;
}

/** Share of this month's budgets used, or null with no budgets. */
export function budgetShare(month: WidgetCache["month"]): number | null {
  if (!month || month.budgetLimitMinor <= 0) return null;
  return month.budgetSpentMinor / month.budgetLimitMinor;
}

/** How many habit rings fit, and in how many columns, for the widget's size (dp). */
export function habitGrid(
  width: number,
  height: number,
  count: number,
): { columns: number; shown: number } {
  const RING = 64;
  const ROW = 78;
  const HEADER = 40;
  const columns = Math.max(1, Math.floor(((width > 0 ? width : 150) - 16) / RING));
  const rows = Math.max(1, Math.floor(((height > 0 ? height : 150) - HEADER) / ROW));
  return { columns, shown: Math.min(count, columns * rows) };
}

/** "until 3:45 pm" while focusing; no ticking clock (a widget can't tick each second). */
export function focusUntil(endsAt: number, timeZone: string): string {
  return `until ${formatClock(endsAt, timeZone)}`;
}

/** The share of a focus period gone, for its ring, as of `now`. */
export function focusShare(focus: { startedAt: number; endsAt: number }, now: number): number {
  const length = focus.endsAt - focus.startedAt;
  if (length <= 0) return 1;
  return Math.min(1, Math.max(0, (now - focus.startedAt) / length));
}
