import { addDays, toLocalDate, weekdayOf } from "@tick-taka/shared/dates";
import { computeStreak, type StreakResult } from "@tick-taka/shared/gamification";
import { vacationDates } from "@tick-taka/shared/schemas/settings";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { transactions } from "../../db/schema/money";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";

const LOOKBACK_DAYS = 400;

export interface GamificationSummary {
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
 * Progress worth keeping an eye on, computed from records: today's tasks against the
 * daily goal, and streaks for meeting that goal and for logging spending the same day.
 */
export function gamificationSummary(deps: Deps): GamificationSummary {
  const { timeZone, today, settings } = userTime(deps);
  const db = deps.db;

  const doneTasks = db
    .select({ doneAt: tasks.doneAt })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), eq(tasks.status, "done"), isNotNull(tasks.doneAt)))
    .all();
  const tasksDoneByDay = new Map<string, number>();
  for (const task of doneTasks) {
    if (task.doneAt === null) continue;
    const date = toLocalDate(task.doneAt, timeZone);
    tasksDoneByDay.set(date, (tasksDoneByDay.get(date) ?? 0) + 1);
  }

  const expenses = db
    .select({ occurredAt: transactions.occurredAt, createdAt: transactions.createdAt })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.type, "expense")))
    .all();
  const loggedDays = new Set<string>();
  for (const tx of expenses) {
    const occurred = toLocalDate(tx.occurredAt, timeZone);
    if (occurred === toLocalDate(tx.createdAt, timeZone)) loggedDays.add(occurred);
  }

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
