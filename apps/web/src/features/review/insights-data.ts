import {
  addDays,
  addMonths,
  eachDay,
  localMonthRange,
  monthOf,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
} from "@tick-taka/shared/dates";

/** Reports' period choices and the numbers behind each chart. Pure. */

export type Range = "week" | "month" | "quarter" | "year";

/**
 * The instants a period covers: this week (from the user's first weekday), this month,
 * the last three months, or the last twelve, each up to the end of the current one.
 */
export function reportSpan(range: Range, today: string, timeZone: string, weekStartsOn = 6) {
  if (range === "week") {
    const first = startOfWeek(today, weekStartsOn);
    return {
      from: startOfLocalDay(first, timeZone),
      to: startOfLocalDay(addDays(first, 7), timeZone),
    };
  }
  const month = monthOf(today);
  const back = range === "month" ? 0 : range === "quarter" ? 2 : 11;
  return {
    from: localMonthRange(addMonths(month, -back), timeZone).from,
    to: localMonthRange(month, timeZone).to,
  };
}

/** How many months the month-by-month charts show for a period: a year shows its twelve. */
export const seriesMonths = (range: Range) => (range === "year" ? 12 : 6);

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

/**
 * A year of days summed into weeks (keyed by each week's first day), for a column
 * chart that stays readable: 52 columns instead of 365.
 */
export function spendingByWeek(
  days: { date: string; spentMinor: number }[],
  weekStartsOn = 6,
): { date: string; spentMinor: number }[] {
  const weeks = new Map<string, number>();
  for (const day of days) {
    const key = startOfWeek(day.date, weekStartsOn);
    weeks.set(key, (weeks.get(key) ?? 0) + day.spentMinor);
  }
  return [...weeks.entries()].map(([date, spentMinor]) => ({ date, spentMinor }));
}

/**
 * A weekly column's axis label: the month's short name on the first week that starts
 * in it (a part week at the start of the period stays unlabelled, so labels never touch).
 */
export function weekTick(date: string, monthName: (month: string) => string) {
  return Number(date.slice(8)) <= 7 ? monthName(date.slice(0, 7)) : undefined;
}

/**
 * Which days get an axis label: every day of a week; else the 1st and every 7th
 * after, so labels never crowd.
 */
export function dayTick(date: string, index: number, total: number): string | undefined {
  const day = Number(date.slice(8));
  if (total <= 10) return String(day);
  const every = total > 40 ? 14 : 7;
  return index === 0 || (day - 1) % every === 0 ? String(day) : undefined;
}
