import { addDays, MINUTE_MS, toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import {
  computeStreak,
  levelFromSparks,
  SPARKS,
  type StreakResult,
  unlockedRewards,
} from "@tick-taka/shared/gamification";
import { vacationDates } from "@tick-taka/shared/schemas/settings";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { transactions } from "../../db/schema/money";
import { habitLogs, habits, tasks, timeEntries } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";

/** Focus sessions shorter than this don't earn sparks. */
const MIN_FOCUS_MINUTES = 10;
const LOOKBACK_DAYS = 400;

export interface GamificationSummary {
  sparks: number;
  sparksToday: number;
  level: ReturnType<typeof levelFromSparks>;
  rewards: ReturnType<typeof unlockedRewards>;
  dailyGoal: {
    goal: number;
    doneToday: number;
    reached: boolean;
    isDayOff: boolean;
    onVacation: boolean;
    streak: StreakResult;
  };
  loggingStreak: StreakResult;
}

/**
 * Sparks are computed from records, never stored: finished tasks (more for the top
 * three), completed focus sessions, expenses logged on the day they happened and
 * checked-off habits.
 */
export function gamificationSummary(deps: Deps): GamificationSummary {
  const { timeZone, today, settings } = userTime(deps);
  const db = deps.db;
  const sparksByDay = new Map<string, number>();
  const add = (date: string, value: number) =>
    sparksByDay.set(date, (sparksByDay.get(date) ?? 0) + value);

  const doneTasks = db
    .select({ doneAt: tasks.doneAt, top3Date: tasks.top3Date })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.status, "done"), isNotNull(tasks.doneAt)))
    .all();
  const tasksDoneByDay = new Map<string, number>();
  for (const task of doneTasks) {
    const date = toLocalDate(task.doneAt!, timeZone);
    add(date, task.top3Date === date ? SPARKS.topThreeTaskDone : SPARKS.taskDone);
    tasksDoneByDay.set(date, (tasksDoneByDay.get(date) ?? 0) + 1);
  }

  const focus = db
    .select({ startedAt: timeEntries.startedAt, endedAt: timeEntries.endedAt })
    .from(timeEntries)
    .where(
      and(
        isNull(timeEntries.deletedAt),
        eq(timeEntries.source, "focus"),
        isNotNull(timeEntries.endedAt),
      ),
    )
    .all();
  for (const entry of focus) {
    if ((entry.endedAt! - entry.startedAt) / MINUTE_MS >= MIN_FOCUS_MINUTES) {
      add(toLocalDate(entry.endedAt!, timeZone), SPARKS.focusSession);
    }
  }

  const expenses = db
    .select({ occurredAt: transactions.occurredAt, createdAt: transactions.createdAt })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.type, "expense")))
    .all();
  const loggedDays = new Set<string>();
  for (const tx of expenses) {
    const occurred = toLocalDate(tx.occurredAt, timeZone);
    if (occurred === toLocalDate(tx.createdAt, timeZone)) {
      add(occurred, SPARKS.expenseLoggedSameDay);
      loggedDays.add(occurred);
    }
  }

  const checks = db
    .select({ date: habitLogs.date, count: habitLogs.count, target: habits.targetCount })
    .from(habitLogs)
    .innerJoin(habits, eq(habits.id, habitLogs.habitId))
    .where(and(isNull(habitLogs.deletedAt), isNull(habits.deletedAt)))
    .all();
  for (const check of checks) if (check.count >= check.target) add(check.date, SPARKS.habitChecked);

  const sparks = [...sparksByDay.values()].reduce((a, b) => a + b, 0);
  const level = levelFromSparks(sparks);

  const vacation = vacationDates(settings, today);
  const skip = new Set(vacation);
  for (let i = 0; i < LOOKBACK_DAYS; i++) {
    const date = addDays(today, -i);
    if (settings.daysOff.includes(weekdayOf(date))) skip.add(date);
  }
  const goalDays = [...tasksDoneByDay.entries()]
    .filter(([, count]) => settings.dailyTaskGoal > 0 && count >= settings.dailyTaskGoal)
    .map(([date]) => date);
  const doneToday = tasksDoneByDay.get(today) ?? 0;

  return {
    sparks,
    sparksToday: sparksByDay.get(today) ?? 0,
    level,
    rewards: unlockedRewards(level.level),
    dailyGoal: {
      goal: settings.dailyTaskGoal,
      doneToday,
      reached: settings.dailyTaskGoal > 0 && doneToday >= settings.dailyTaskGoal,
      isDayOff: settings.daysOff.includes(weekdayOf(today)),
      onVacation: vacation.has(today),
      streak: computeStreak({
        schedule: "daily",
        doneDates: goalDays,
        today,
        skipDates: skip,
        maxPeriods: LOOKBACK_DAYS,
      }),
    },
    loggingStreak: computeStreak({
      schedule: "daily",
      doneDates: loggedDays,
      today,
      skipDates: vacation,
      maxPeriods: LOOKBACK_DAYS,
    }),
  };
}
