import {
  addDays,
  addMonths,
  daysInMonth,
  endOfLocalDay,
  type LocalDate,
  type LocalMonth,
  localMonthRange,
  monthOf,
  startOfLocalDay,
  startOfWeek,
} from "@tick-taka/shared/dates";
import { and, asc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { transactions } from "../../db/schema/money";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";
import { budgetMonth } from "../budgets/service";
import { habitService } from "../habits/service";
import { spotSubscriptions } from "../insights/spotter";
import { insightsSummary, netWorthSeries } from "../insights/summary";
import { timeEntryService } from "../time-entries/service";

/** Rounds a suggested limit up to the next ৳100. */
const roundUpTo100Taka = (minor: number) => Math.ceil(minor / 10_000) * 10_000;

/** Numbers for the 5-minute Sunday review. AI may explain these, never compute them. */
export function weeklyReview(deps: Deps, weekStartInput?: LocalDate) {
  const { timeZone, today, settings } = userTime(deps);
  const weekStart = weekStartInput ?? startOfWeek(today, settings.weekStartsOn);
  const range = {
    from: startOfLocalDay(weekStart, timeZone),
    to: startOfLocalDay(addDays(weekStart, 7), timeZone),
  };
  const db = deps.db;

  const weekTasks = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        gte(tasks.doAt, range.from),
        lt(tasks.doAt, range.to),
      ),
    )
    .all();
  const plannedByArea = sumBy(
    weekTasks,
    (t) => t.areaId,
    (t) => t.estimateMin ?? 30,
  );
  const tracked = timeEntryService(deps).minutesByArea(range);
  const areaIds = new Set([...plannedByArea.keys(), ...tracked.map((t) => t.areaId)]);
  const hoursVsPlan = [...areaIds].map((areaId) => ({
    areaId,
    plannedMinutes: plannedByArea.get(areaId) ?? 0,
    trackedMinutes: tracked.find((t) => t.areaId === areaId)?.minutes ?? 0,
  }));

  const done = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        eq(tasks.status, "done"),
        gte(tasks.doneAt, range.from),
        lt(tasks.doneAt, range.to),
      ),
    )
    .orderBy(asc(tasks.doneAt))
    .all();
  const topThreePlanned =
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          gte(tasks.top3Date, weekStart),
          lt(tasks.top3Date, addDays(weekStart, 7)),
        ),
      )
      .get()?.n ?? 0;
  const topThreeDone = done.filter((t) => t.top3Date !== null).length;

  // Spending vs. this week's share of the month's flexible budget.
  const month = monthOf(weekStart);
  const budgets = budgetMonth(deps, month, { today });
  const weeklyShare =
    Math.round((budgets.buckets.flexible.limitMinor * 7) / daysInMonth(month) / 100) * 100;
  const spending = spendingRows(db, range);
  const spentMinor = spending.reduce((sum, row) => sum + row.amountMinor, 0);

  const focus = timeEntryService(deps).focusStats(range, timeZone);
  const habits = habitService(deps)
    .listWithProgress(addDays(weekStart, 6) < today ? addDays(weekStart, 6) : today)
    .map((h) => ({
      id: h.id,
      name: h.name,
      emoji: h.emoji,
      streak: h.streak.current,
      best: h.streak.best,
      unit: h.streak.unit,
    }));

  return {
    weekStart,
    hoursVsPlan,
    spending: {
      spentMinor,
      flexibleWeeklyBudgetMinor: weeklyShare,
      byCategory: [
        ...sumBy(
          spending,
          (r) => r.categoryId,
          (r) => r.amountMinor,
        ).entries(),
      ]
        .map(([categoryId, amountMinor]) => ({ categoryId, amountMinor }))
        .sort((a, b) => b.amountMinor - a.amountMinor),
    },
    habits,
    wins: {
      tasksDone: done.length,
      topThreeDone,
      topThreePlanned,
      focusMinutes: focus.totalMinutes,
      focusSessions: focus.sessions,
      highlights: done
        .filter((t) => t.top3Date !== null || t.priority === "high")
        .slice(-5)
        .map((t) => t.title),
    },
    focus: settings.weeklyFocus,
  };
}

/** Monthly review: budgets vs. actual, net worth change, hourly rates, Someday list. */
export function monthlyReview(deps: Deps, monthInput?: LocalMonth) {
  const { timeZone, today } = userTime(deps);
  const month = monthInput ?? monthOf(today);
  const range = localMonthRange(month, timeZone);
  const summary = insightsSummary(deps, range);
  const worth = netWorthSeries(deps, 13).series;
  const index = worth.findIndex((point) => point.month === month);
  const end = index >= 0 ? worth[index]!.netWorthMinor : null;
  const start = index > 0 ? worth[index - 1]!.netWorthMinor : null;
  const someday = deps.db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.status, "someday")))
    .orderBy(asc(tasks.createdAt))
    .all();
  return {
    month,
    budgets: budgetMonth(deps, month, { today }),
    netWorth: {
      startMinor: start,
      endMinor: end,
      changeMinor: start !== null && end !== null ? end - start : null,
    },
    totals: summary.totals,
    hourlyRates: summary.hourlyRates,
    hoursByArea: summary.hoursByArea,
    someday,
    subscriptions: spotSubscriptions(deps),
    suggestedBudgets: suggestBudgets(deps, addMonths(month, 1)),
  };
}

/** Next month's budgets from the average of the last three months of spending. */
export function suggestBudgets(deps: Deps, month: LocalMonth) {
  const { timeZone } = userTime(deps);
  const totals = new Map<string | null, number>();
  for (let i = 1; i <= 3; i++) {
    const rows = spendingRows(deps.db, localMonthRange(addMonths(month, -i), timeZone));
    for (const [categoryId, amount] of sumBy(
      rows,
      (r) => r.categoryId,
      (r) => r.amountMinor,
    )) {
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + amount);
    }
  }
  return [...totals.entries()]
    .filter((entry): entry is [string, number] => entry[0] !== null)
    .map(([categoryId, total]) => ({ categoryId, limitMinor: roundUpTo100Taka(total / 3) }))
    .filter((line) => line.limitMinor > 0)
    .sort((a, b) => b.limitMinor - a.limitMinor);
}

/** Daily shutdown: what's left to close the day. */
export function shutdownReview(deps: Deps, date?: LocalDate) {
  const { timeZone, today } = userTime(deps);
  const day = date ?? today;
  const from = startOfLocalDay(day, timeZone);
  const to = endOfLocalDay(day, timeZone);
  const tomorrow = addDays(day, 1);
  const db = deps.db;
  const loggedToday =
    db
      .select({ n: sql<number>`count(*)` })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          gte(transactions.occurredAt, from),
          lt(transactions.occurredAt, to),
        ),
      )
      .get()?.n ?? 0;
  const doneToday =
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(and(isNull(tasks.deletedAt), gte(tasks.doneAt, from), lt(tasks.doneAt, to)))
      .get()?.n ?? 0;
  const tomorrowTopThree = db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.top3Date, tomorrow)))
    .all();
  const tomorrowCandidates = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        sql`${tasks.status} in ('inbox', 'open')`,
        lt(tasks.doAt, endOfLocalDay(tomorrow, timeZone)),
      ),
    )
    .orderBy(asc(tasks.doAt))
    .limit(20)
    .all()
    .filter((t) => t.top3Date !== tomorrow);
  return {
    date: day,
    tomorrow,
    transactionsLogged: loggedToday,
    tasksDone: doneToday,
    habitsUnchecked: habitService(deps)
      .listWithProgress(day)
      .filter((h) => !h.doneToday && h.schedule === "daily"),
    tomorrowTopThree,
    tomorrowCandidates,
  };
}
