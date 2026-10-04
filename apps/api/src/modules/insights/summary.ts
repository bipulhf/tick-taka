import {
  addDays,
  addMonths,
  DAY_MS,
  type InstantRange,
  type LocalDate,
  type LocalMonth,
  localMonthRange,
  monthOf,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
} from "@tick-taka/shared/dates";
import { effectiveHourlyRate } from "@tick-taka/shared/finance";
import { and, inArray, isNull, sql } from "drizzle-orm";
import { accounts } from "../../db/schema/money";
import { areas, tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { accountMovements, incomeRows, spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";
import { timeEntryService } from "../time-entries/service";

const toList = (totals: Map<string | null, number>, key: string) =>
  [...totals.entries()]
    .map(([id, amountMinor]) => ({ [key]: id, amountMinor }))
    .sort((a, b) => (b.amountMinor as number) - (a.amountMinor as number));

/** Totals by category, area and day; hours by area; effective hourly rates. */
export function insightsSummary(deps: Deps, range: InstantRange) {
  const { timeZone } = userTime(deps);
  const spending = spendingRows(deps.db, range);
  const income = incomeRows(deps.db, range);
  const minutes = timeEntryService(deps).minutesByArea(range);
  const incomeByArea = sumBy(
    income,
    (r) => r.areaId,
    (r) => r.amountMinor,
  );

  const days = new Map<string, { date: string; spentMinor: number; incomeMinor: number }>();
  const day = (ms: number) => {
    const date = toLocalDate(ms, timeZone);
    const entry = days.get(date) ?? { date, spentMinor: 0, incomeMinor: 0 };
    days.set(date, entry);
    return entry;
  };
  for (const row of spending) day(row.occurredAt).spentMinor += row.amountMinor;
  for (const row of income) day(row.occurredAt).incomeMinor += row.amountMinor;

  const spentMinor = spending.reduce((sum, row) => sum + row.amountMinor, 0);
  const incomeMinor = income.reduce((sum, row) => sum + row.amountMinor, 0);
  return {
    range,
    totals: { spentMinor, incomeMinor, netMinor: incomeMinor - spentMinor },
    spendingByCategory: toList(
      sumBy(
        spending,
        (r) => r.categoryId,
        (r) => r.amountMinor,
      ),
      "categoryId",
    ) as {
      categoryId: string | null;
      amountMinor: number;
    }[],
    spendingByArea: toList(
      sumBy(
        spending,
        (r) => r.areaId,
        (r) => r.amountMinor,
      ),
      "areaId",
    ) as {
      areaId: string | null;
      amountMinor: number;
    }[],
    incomeByCategory: toList(
      sumBy(
        income,
        (r) => r.categoryId,
        (r) => r.amountMinor,
      ),
      "categoryId",
    ) as {
      categoryId: string | null;
      amountMinor: number;
    }[],
    byDay: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)),
    hoursByArea: minutes.map((m) => ({
      areaId: m.areaId,
      minutes: m.minutes,
      focusMinutes: m.focusMinutes,
    })),
    hourlyRates: [...new Set([...incomeByArea.keys(), ...minutes.map((m) => m.areaId)])]
      .filter((areaId): areaId is string => areaId !== null)
      .map((areaId) => {
        const incomeForArea = incomeByArea.get(areaId) ?? 0;
        const trackedMinutes = minutes.find((m) => m.areaId === areaId)?.minutes ?? 0;
        return {
          areaId,
          incomeMinor: incomeForArea,
          minutes: trackedMinutes,
          rateMinor: effectiveHourlyRate(incomeForArea, trackedMinutes),
        };
      }),
  };
}

/** Overall hourly rate over the last 90 days, for "≈ 6.5 hours of work". */
export function overallHourlyRate(deps: Deps): { rateMinor: number | null; days: number } {
  const now = deps.now();
  const range = { from: now - 90 * DAY_MS, to: now + 1 };
  const incomeTotal = incomeRows(deps.db, range).reduce((sum, row) => sum + row.amountMinor, 0);
  const minutes = timeEntryService(deps)
    .minutesByArea(range)
    .reduce((sum, row) => sum + row.minutes, 0);
  return { rateMinor: effectiveHourlyRate(incomeTotal, minutes), days: 90 };
}

/** Net worth at the end of each of the last `months` months, in the default currency. */
export function netWorthSeries(deps: Deps, months: number) {
  const { timeZone, today, settings } = userTime(deps);
  const accountRows = deps.db.select().from(accounts).where(isNull(accounts.deletedAt)).all();
  const counted = accountRows.filter((a) => a.currency === settings.defaultCurrency);
  const opening = counted.reduce((sum, a) => sum + a.openingMinor, 0);
  const ids = new Set(counted.map((a) => a.id));
  const current = monthOf(today);
  const series: { month: LocalMonth; netWorthMinor: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(current, -i);
    const end = i === 0 ? deps.now() + 1 : localMonthRange(month, timeZone).to;
    const movements = accountMovements(deps.db, end);
    let total = opening;
    for (const [id, value] of movements) if (ids.has(id)) total += value;
    series.push({ month, netWorthMinor: total });
  }
  return {
    currency: settings.defaultCurrency,
    excludedAccounts: accountRows
      .filter((a) => !ids.has(a.id))
      .map((a) => ({ id: a.id, name: a.name, currency: a.currency })),
    series,
  };
}

/** Income vs. expense for each of the last `months` months. */
export function monthlySeries(deps: Deps, months: number) {
  const { timeZone, today } = userTime(deps);
  const current = monthOf(today);
  return Array.from({ length: months }, (_, index) => {
    const month = addMonths(current, index - months + 1);
    const range = localMonthRange(month, timeZone);
    return {
      month,
      spentMinor: spendingRows(deps.db, range).reduce((sum, row) => sum + row.amountMinor, 0),
      incomeMinor: incomeRows(deps.db, range).reduce((sum, row) => sum + row.amountMinor, 0),
    };
  });
}

/** Per area: hours this week, money in and out this month, open tasks. */
export function areaDashboard(deps: Deps, date?: LocalDate) {
  const { timeZone, today, settings } = userTime(deps);
  const day = date ?? today;
  const weekStart = startOfWeek(day, settings.weekStartsOn);
  const week = {
    from: startOfLocalDay(weekStart, timeZone),
    to: startOfLocalDay(addDays(weekStart, 7), timeZone),
  };
  const month = localMonthRange(monthOf(day), timeZone);
  const minutes = timeEntryService(deps).minutesByArea(week);
  const spent = sumBy(
    spendingRows(deps.db, month),
    (r) => r.areaId,
    (r) => r.amountMinor,
  );
  const earned = sumBy(
    incomeRows(deps.db, month),
    (r) => r.areaId,
    (r) => r.amountMinor,
  );
  const openTasks = new Map(
    deps.db
      .select({ areaId: tasks.areaId, n: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          isNull(tasks.parentId),
          inArray(tasks.status, ["inbox", "open"]),
        ),
      )
      .groupBy(tasks.areaId)
      .all()
      .map((row) => [row.areaId, row.n]),
  );
  return deps.db
    .select()
    .from(areas)
    .where(isNull(areas.deletedAt))
    .orderBy(areas.sort)
    .all()
    .map((area) => ({
      area,
      weekMinutes: minutes.find((m) => m.areaId === area.id)?.minutes ?? 0,
      monthIncomeMinor: earned.get(area.id) ?? 0,
      monthSpentMinor: spent.get(area.id) ?? 0,
      openTasks: openTasks.get(area.id) ?? 0,
    }));
}
