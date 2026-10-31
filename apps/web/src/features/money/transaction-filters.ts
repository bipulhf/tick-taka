import {
  addMonths,
  endOfLocalDay,
  isLocalDate,
  isLocalMonth,
  localMonthRange,
  startOfLocalDay,
  toLocalDate,
} from "@tick-taka/shared/dates";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

/**
 * The transactions view's filters, kept in the URL (`?accountId=…&month=2026-10`), and
 * whether it shows the list or the month grid (`?view=month&day=2026-10-12`). Pure.
 */

export type TypeFilter = "expense" | "income" | "transfer";
const TYPES: TypeFilter[] = ["expense", "income", "transfer"];

export interface TransactionFilters {
  q?: string;
  type?: TypeFilter;
  accountId?: string;
  categoryId?: string;
  eventId?: string;
  /** "YYYY-MM" */
  month?: string;
  /** "YYYY-MM-DD": one day, picked on the month grid. */
  day?: string;
}

/** The month grid instead of the list; the list stays below it. */
export type TransactionsLayout = "list" | "month";

export interface TransactionSearch extends TransactionFilters, PanelSearch {
  view?: "month";
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

/** The route's search: the filters plus the panel's own keys. */
export function validateTransactionSearch(search: Record<string, unknown>): TransactionSearch {
  const month = text(search.month);
  const day = text(search.day);
  return {
    view: search.view === "month" ? "month" : undefined,
    day: day && isLocalDate(day) ? day : undefined,
    ...validatePanelSearch(search),
    q: text(search.q),
    type: TYPES.find((t) => t === search.type),
    accountId: text(search.accountId),
    categoryId: text(search.categoryId),
    eventId: text(search.eventId),
    month: month && isLocalMonth(month) ? month : undefined,
  };
}

export const isFiltered = (filters: TransactionFilters) =>
  Boolean(
    filters.q ||
      filters.type ||
      filters.accountId ||
      filters.categoryId ||
      filters.eventId ||
      filters.month ||
      filters.day,
  );

/**
 * The API query for the filters; a day or a month becomes its instant range in the
 * user's zone (a day wins over the month around it).
 */
export function filtersToQuery(filters: TransactionFilters, timeZone: string) {
  const range = filters.day
    ? { from: startOfLocalDay(filters.day, timeZone), to: endOfLocalDay(filters.day, timeZone) }
    : filters.month
      ? localMonthRange(filters.month, timeZone)
      : null;
  return {
    ...(filters.q?.trim() ? { q: filters.q.trim() } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.eventId ? { eventId: filters.eventId } : {}),
    ...(range ? { from: String(range.from), to: String(range.to) } : {}),
  };
}

/** Newest first, in runs of one local day each, as the list shows them. */
export function groupByDay<T extends { occurredAt: number }>(
  items: T[],
  timeZone: string,
): { date: string; items: T[] }[] {
  const days: { date: string; items: T[] }[] = [];
  for (const item of items) {
    const date = toLocalDate(item.occurredAt, timeZone);
    const last = days.at(-1);
    if (last?.date === date) last.items.push(item);
    else days.push({ date, items: [item] });
  }
  return days;
}

/** This month and the `count - 1` before it, newest first, for the month filter. */
export function recentMonths(thisMonth: string, count = 18): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(thisMonth, -i));
}

/** Expense or income categories, each parent followed by its children, for a Select. */
export function categoryOptions(
  categories: { id: string; name: string; emoji: string; kind: string; parentId: string | null }[],
  kind?: "expense" | "income",
): { value: string; label: string; leading: string; hint?: string }[] {
  const pool = kind ? categories.filter((c) => c.kind === kind) : categories;
  const parents = pool.filter((c) => c.parentId === null || !pool.some((p) => p.id === c.parentId));
  return parents.flatMap((parent) => [
    { value: parent.id, label: parent.name, leading: parent.emoji },
    ...pool
      .filter((c) => c.parentId === parent.id)
      .map((c) => ({ value: c.id, label: c.name, leading: c.emoji, hint: parent.name })),
  ]);
}
