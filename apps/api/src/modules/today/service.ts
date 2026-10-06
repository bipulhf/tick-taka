import {
  addDays,
  endOfLocalDay,
  type LocalDate,
  localParts,
  startOfLocalDay,
  weekdayOf,
} from "@tick-taka/shared/dates";
import { greeting, tikiLine, tikiMood } from "@tick-taka/shared/tiki";
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { debts } from "../../db/schema/money";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { budgetMonth, safeToSpend } from "../budgets/service";
import { gamificationSummary } from "../gamification/service";
import { goalService } from "../goals/service";
import { habitService } from "../habits/service";
import { recurringService } from "../recurring/service";
import { timeEntryService } from "../time-entries/service";

type Task = typeof tasks.$inferSelect;

export type TimelineItem =
  | { kind: "task"; at: number | null; minutes: number; task: Task }
  | {
      kind: "bill" | "payday";
      at: number;
      minutes: 0;
      id: string;
      name: string;
      amountMinor: number;
      currency: string;
      /** Paid from or into; null means the default account. */
      accountId: string | null;
      overdue: boolean;
      /** The local date it was due (YYYY-MM-DD), so a late bill can say "Was due Mon 5 Oct". */
      dueDate: string;
    }
  | {
      kind: "debt";
      at: number;
      minutes: 0;
      id: string;
      person: string;
      direction: string;
      principalMinor: number;
    };

const DEFAULT_TASK_MINUTES = 30;
const OPEN = ["inbox", "open"] as const;

/** Everything the Today screen needs, in one call. */
export function todayView(deps: Deps, date?: LocalDate) {
  const { timeZone, today, settings, now } = userTime(deps);
  const day = date ?? today;
  const from = startOfLocalDay(day, timeZone);
  const to = endOfLocalDay(day, timeZone);
  const db = deps.db;

  goalService(deps).ensureMonthlyTasks();

  const dayTasks = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        gte(tasks.doAt, from),
        lt(tasks.doAt, to),
      ),
    )
    .orderBy(asc(tasks.doAt), asc(tasks.sort))
    .all();
  const topThree = db
    .select()
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.top3Date, day)))
    .orderBy(asc(tasks.sort), asc(tasks.createdAt))
    .all();
  const topIds = new Set(topThree.map((t) => t.id));

  const recurring = recurringService(deps).listWithStatus();
  const billsToday = recurring.filter(
    (item) => item.dueDate <= day && (item.dueDate === day || item.status === "overdue"),
  );
  const debtReminders = db
    .select()
    .from(debts)
    .where(
      and(
        isNull(debts.deletedAt),
        isNull(debts.closedAt),
        isNotNull(debts.remindAt),
        gte(debts.remindAt, from),
        lt(debts.remindAt, to),
      ),
    )
    .all()
    .filter((debt): debt is typeof debt & { remindAt: number } => debt.remindAt !== null);

  const timeline: TimelineItem[] = [
    ...dayTasks
      .filter((task) => task.whenSlot === "day" && task.status !== "someday")
      .map((task) => ({
        kind: "task" as const,
        at: task.hasTime ? task.doAt : null,
        minutes: task.estimateMin ?? DEFAULT_TASK_MINUTES,
        task,
      })),
    ...billsToday.map((item) => ({
      kind: item.kind === "bill" ? ("bill" as const) : ("payday" as const),
      at: Math.max(item.nextDueAt, from),
      minutes: 0 as const,
      id: item.id,
      name: item.name,
      amountMinor: item.amountMinor,
      currency: item.currency,
      accountId: item.accountId,
      overdue: item.status === "overdue",
      dueDate: item.dueDate,
    })),
    ...debtReminders.map((debt) => ({
      kind: "debt" as const,
      at: debt.remindAt,
      minutes: 0 as const,
      id: debt.id,
      person: debt.person,
      direction: debt.direction,
      principalMinor: debt.principalMinor,
    })),
  ].sort((a, b) => (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER));

  // "Does my day fit?": planned minutes of open daytime tasks against free time.
  const plannedTasks = [
    ...dayTasks.filter((t) => t.whenSlot === "day"),
    ...topThree.filter((t) => !dayTasks.some((d) => d.id === t.id)),
  ].filter((task) => OPEN.includes(task.status as (typeof OPEN)[number]) && !task.parentId);
  const plannedMinutes = plannedTasks.reduce(
    (sum, task) => sum + (task.estimateMin ?? DEFAULT_TASK_MINUTES),
    0,
  );
  const isDayOff = settings.daysOff.includes(weekdayOf(day));
  const capacityMinutes = settings.dayCapacityMinutes;

  const evening = dayTasks.filter(
    (task) => task.whenSlot === "evening" && task.status !== "someday" && !topIds.has(task.id),
  );
  const upcoming = recurring.filter((item) => item.dueDate > day).slice(0, 3);

  const overdueCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          isNull(tasks.parentId),
          inArray(tasks.status, OPEN),
          lt(tasks.doAt, startOfLocalDay(today, timeZone)),
        ),
      )
      .get()?.n ?? 0;
  // The latest one is named on Today, so "from earlier" is never a mystery.
  const latestOverdue =
    overdueCount > 0
      ? (db
          .select({ title: tasks.title })
          .from(tasks)
          .where(
            and(
              isNull(tasks.deletedAt),
              isNull(tasks.parentId),
              inArray(tasks.status, OPEN),
              lt(tasks.doAt, startOfLocalDay(today, timeZone)),
            ),
          )
          .orderBy(desc(tasks.doAt))
          .get()?.title ?? null)
      : null;
  const inboxCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          isNull(tasks.parentId),
          eq(tasks.status, "inbox"),
          isNull(tasks.doAt),
        ),
      )
      .get()?.n ?? 0;

  const money = safeToSpend(deps, day);
  // Pace alert: the one flexible category running furthest ahead of the month.
  const paceAlert =
    budgetMonth(deps, day.slice(0, 7), { today: day })
      .lines.filter((line) => line.pace === "ahead" && line.budgetType === "flexible")
      .sort(
        (a, b) =>
          b.spentMinor / Math.max(1, b.limitMinor) - a.spentMinor / Math.max(1, a.limitMinor),
      )[0] ?? null;

  const running = timeEntryService(deps).running();
  const hour = day === today ? localParts(now, timeZone).hour : 9;
  const topThreeDone = topThree.filter((t) => t.status === "done").length;
  const mood = tikiMood({
    hour,
    topThreeTotal: topThree.length,
    topThreeDone,
    focusRunning: running?.source === "focus",
    leftTodayMinor: money.hasBudgets ? money.leftTodayMinor : null,
    emptyDay: dayTasks.length === 0 && topThree.length === 0,
  });

  return {
    date: day,
    greeting: greeting(hour),
    tiki: { mood, line: tikiLine(mood, day) },
    safeToSpend: money,
    paceAlert,
    topThree,
    timeline,
    dayFit: {
      plannedMinutes,
      capacityMinutes,
      overflowMinutes: Math.max(0, plannedMinutes - capacityMinutes),
      isDayOff,
    },
    habits: habitService(deps).listWithProgress(day),
    runningTimer: running,
    evening,
    upcoming,
    counts: { overdue: overdueCount, latestOverdue, inbox: inboxCount },
    gamification: gamificationSummary(deps),
    tomorrow: addDays(day, 1),
  };
}
