import { addDays, addMonths, lastDayOfMonth, monthOf } from "@tick-taka/shared/dates";
import { nextOccurrence, parseRRule } from "@tick-taka/shared/recurrence";
import type { PillStatus } from "@/components/ui/status-pill";
import type { BillStatus } from "./bill-status";

/** What Bills and income works out from the recurring list and this month's transactions. */

export type BillGroupKey = "overdue" | "week" | "month" | "next" | "later";

const TITLES: Record<BillGroupKey, string> = {
  overdue: "Overdue",
  week: "This week",
  month: "Later this month",
  next: "Next month",
  later: "Later",
};

const ORDER: BillGroupKey[] = ["overdue", "week", "month", "next", "later"];

/** Which group a due date falls in: late, the next 7 days, the rest of this month, next month, later. */
export function billGroupOf(dueDate: string, today: string): BillGroupKey {
  if (dueDate < today) return "overdue";
  if (dueDate <= addDays(today, 6)) return "week";
  const month = monthOf(today);
  if (monthOf(dueDate) === month) return "month";
  if (monthOf(dueDate) === addMonths(month, 1)) return "next";
  return "later";
}

/** Items grouped by when they're due, soonest first; empty groups are left out. */
export function groupBills<R extends { dueDate: string }>(
  items: R[],
  today: string,
): { key: BillGroupKey; title: string; items: R[] }[] {
  const sorted = [...items].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return ORDER.map((key) => ({
    key,
    title: TITLES[key],
    items: sorted.filter((item) => billGroupOf(item.dueDate, today) === key),
  })).filter((group) => group.items.length > 0);
}

/** A group's total in one currency; items in other currencies are left out, not mixed in. */
export function groupTotal(
  items: { amountMinor: number; currency: string }[],
  currency: string,
): number {
  return items
    .filter((item) => item.currency === currency)
    .reduce((sum, item) => sum + item.amountMinor, 0);
}

/** The most dates one item can have in a month (a daily bill, plus a late one). */
const MAX_DATES = 62;

/** Whether a rule repeats more than once a month (daily, weekly). */
function repeatsWithinMonth(rrule: string): boolean {
  try {
    const { freq } = parseRRule(rrule);
    return freq === "DAILY" || freq === "WEEKLY";
  } catch {
    return false;
  }
}

/**
 * The dates an item is still due this month: its next due date (a late one counts), then,
 * for a daily or weekly one, each repeat up to the month's last day. A monthly or yearly
 * one counts once, so the totals match the rows on the page.
 */
export function datesDueThisMonth(item: { rrule: string; dueDate: string }, today: string) {
  const last = lastDayOfMonth(monthOf(today));
  if (item.dueDate > last) return [];
  if (!repeatsWithinMonth(item.rrule)) return [item.dueDate];
  const dates: string[] = [];
  let date: string | null = item.dueDate;
  while (date && date <= last && dates.length < MAX_DATES) {
    dates.push(date);
    date = nextOccurrence(item.rrule, date, date);
  }
  return dates;
}

export interface MonthAhead {
  /** Bills still to pay this month, late ones included. */
  stillToPayMinor: number;
  billsLeft: number;
  /** Income still expected this month. */
  expectedMinor: number;
  incomeLeft: number;
}

/** What is still to pay and still expected this month, in one currency. */
export function monthAhead(
  items: { kind: string; amountMinor: number; currency: string; rrule: string; dueDate: string }[],
  today: string,
  currency: string,
): MonthAhead {
  const result: MonthAhead = { stillToPayMinor: 0, billsLeft: 0, expectedMinor: 0, incomeLeft: 0 };
  for (const item of items) {
    if (item.currency !== currency) continue;
    const count = datesDueThisMonth(item, today).length;
    if (item.kind === "income") {
      result.expectedMinor += count * item.amountMinor;
      result.incomeLeft += count;
    } else {
      result.stillToPayMinor += count * item.amountMinor;
      result.billsLeft += count;
    }
  }
  return result;
}

export interface MonthSettled {
  paidMinor: number;
  paidCount: number;
  receivedMinor: number;
  /** The bills and incomes with a payment logged this month. */
  ids: Set<string>;
}

/**
 * What Paid and Received logged this month: the month's transactions that carry a
 * recurring id. Only those in `currency` are added up; every one still marks its item.
 */
export function settledThisMonth<
  T extends { recurringId: string | null; type: string; amountMinor: number },
>(transactions: T[], inCurrency: (tx: T) => boolean): MonthSettled {
  const result: MonthSettled = { paidMinor: 0, paidCount: 0, receivedMinor: 0, ids: new Set() };
  for (const tx of transactions) {
    if (!tx.recurringId) continue;
    result.ids.add(tx.recurringId);
    if (!inCurrency(tx)) continue;
    if (tx.type === "expense") {
      result.paidMinor += tx.amountMinor;
      result.paidCount += 1;
    } else if (tx.type === "income") result.receivedMinor += tx.amountMinor;
  }
  return result;
}

/**
 * The pill a row shows: late, due today or due soon as the server says; "Paid" when this
 * month's is logged and the next one falls in a later month. Nothing for the rest.
 */
export function billPill(
  item: { status: BillStatus; dueDate: string },
  settled: boolean,
  today: string,
): PillStatus | null {
  if (item.status === "overdue" || item.status === "due_today") return item.status;
  if (settled && monthOf(item.dueDate) > monthOf(today)) return "paid";
  if (item.status === "due_soon") return "due_soon";
  return null;
}
