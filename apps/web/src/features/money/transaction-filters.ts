import { addMonths, isLocalMonth, localMonthRange, toLocalDate } from "@tick-taka/shared/dates";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

/** The transactions view's filters, kept in the URL (`?accountId=…&month=2026-10`). Pure. */

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
}

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value : undefined);

/** The route's search: the filters plus the panel's own keys. */
export function validateTransactionSearch(
  search: Record<string, unknown>,
): TransactionFilters & PanelSearch {
  const month = text(search.month);
  return {
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
      filters.month,
  );

/** The API query for the filters; a month becomes its instant range in the user's zone. */
export function filtersToQuery(filters: TransactionFilters, timeZone: string) {
  const range = filters.month ? localMonthRange(filters.month, timeZone) : null;
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
