import { addMonths, eachDay, localMonthRange, toLocalDate } from "@tick-taka/shared/dates";

/** Reports' period choices and the numbers behind each chart. Pure. */

export type Range = "this" | "last" | "quarter";

/** The instants a period covers: this month, last month, or the last three months. */
export function reportSpan(range: Range, month: string, timeZone: string) {
  if (range === "this") return localMonthRange(month, timeZone);
  if (range === "last") return localMonthRange(addMonths(month, -1), timeZone);
  return {
    from: localMonthRange(addMonths(month, -2), timeZone).from,
    to: localMonthRange(month, timeZone).to,
  };
}

interface CategoryLike {
  id: string;
  parentId: string | null;
}

/** Child categories rolled into their parents, largest first, for a readable ranking. */
export function rollUpByParent(
  rows: { categoryId: string | null; amountMinor: number }[],
  categories: CategoryLike[],
): [string | null, number][] {
  const parentOf = (id: string | null) => categories.find((c) => c.id === id)?.parentId ?? id;
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    const key = parentOf(row.categoryId);
    totals.set(key, (totals.get(key) ?? 0) + row.amountMinor);
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]);
}

interface SummaryLike {
  spendingByArea: { areaId: string | null; amountMinor: number }[];
  hoursByArea: { areaId: string | null; minutes: number }[];
  hourlyRates: { areaId: string; rateMinor: number | null }[];
}

/** Each area's spending, tracked minutes and hourly rate; areas with none of them left out. */
export function areaStats<A extends { id: string }>(areas: A[], summary: SummaryLike | undefined) {
  return areas
    .map((area) => ({
      area,
      spent: summary?.spendingByArea.find((r) => r.areaId === area.id)?.amountMinor ?? 0,
      minutes: summary?.hoursByArea.find((r) => r.areaId === area.id)?.minutes ?? 0,
      rate: summary?.hourlyRates.find((r) => r.areaId === area.id)?.rateMinor ?? null,
    }))
    .filter((row) => row.spent || row.minutes || row.rate);
}

/**
 * Spending for every day of the period, zeros included, so the columns keep their
 * places; days after today are left off.
 */
export function spendingByDay(
  byDay: { date: string; spentMinor: number }[],
  span: { from: number; to: number },
  today: string,
  timeZone: string,
): { date: string; spentMinor: number }[] {
  const first = toLocalDate(span.from, timeZone);
  const lastInSpan = toLocalDate(span.to - 1, timeZone);
  const last = lastInSpan < today ? lastInSpan : today;
  if (last < first) return [];
  const spent = new Map(byDay.map((d) => [d.date, d.spentMinor]));
  return eachDay(first, last).map((date) => ({ date, spentMinor: spent.get(date) ?? 0 }));
}

/** Which days get an axis label: the 1st and every 7th after, so labels never crowd. */
export function dayTick(date: string, index: number, total: number): string | undefined {
  const day = Number(date.slice(8));
  const every = total > 40 ? 14 : 7;
  return index === 0 || (day - 1) % every === 0 ? String(day) : undefined;
}
