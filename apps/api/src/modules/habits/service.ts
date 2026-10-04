import { addDays, type LocalDate, startOfWeek } from "@tick-taka/shared/dates";
import { computeStreak, type StreakResult } from "@tick-taka/shared/gamification";
import { vacationDates } from "@tick-taka/shared/schemas/settings";
import type { habitCreateSchema, habitUpdateSchema } from "@tick-taka/shared/schemas/time";
import { and, asc, eq, gte, isNotNull, isNull, lte } from "drizzle-orm";
import type { z } from "zod";
import { habitLogs, habits } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";

export type Habit = typeof habits.$inferSelect;
export type HabitLog = typeof habitLogs.$inferSelect;

export interface HabitWithProgress extends Habit {
  todayCount: number;
  doneToday: boolean;
  weekDoneDays: number;
  streak: StreakResult;
}

const STREAK_LOOKBACK_DAYS = 730;

export function habitService(deps: Deps) {
  const base = crud(deps.db, habits, "Habit", deps.now);
  const db = deps.db;

  function logsBetween(habitId: string | null, from: LocalDate, to: LocalDate): HabitLog[] {
    return db
      .select()
      .from(habitLogs)
      .where(
        and(
          isNull(habitLogs.deletedAt),
          habitId ? eq(habitLogs.habitId, habitId) : undefined,
          gte(habitLogs.date, from),
          lte(habitLogs.date, to),
        ),
      )
      .orderBy(asc(habitLogs.date))
      .all();
  }

  function withProgress(
    habit: Habit,
    logs: HabitLog[],
    date: LocalDate,
    skip: Set<string>,
    weekStartsOn: number,
  ): HabitWithProgress {
    const doneDates = logs.filter((log) => log.count >= habit.targetCount).map((log) => log.date);
    const todayCount = logs.find((log) => log.date === date)?.count ?? 0;
    const weekStart = startOfWeek(date, weekStartsOn);
    const weekDoneDays = doneDates.filter((d) => d >= weekStart && d <= date).length;
    return {
      ...habit,
      todayCount,
      doneToday: todayCount >= habit.targetCount,
      weekDoneDays,
      streak: computeStreak({
        schedule: habit.schedule,
        perWeek: habit.perWeek,
        doneDates,
        today: date,
        skipDates: skip,
        weekStartsOn,
      }),
    };
  }

  return {
    ...base,

    /** Habits with today's count and streaks as of `date`. */
    listWithProgress(date?: LocalDate, includeArchived = false): HabitWithProgress[] {
      const { today, settings } = userTime(deps);
      const day = date ?? today;
      const list = base.list(
        includeArchived ? undefined : isNull(habits.archivedAt),
        asc(habits.sort),
      );
      const logs = logsBetween(null, addDays(day, -STREAK_LOOKBACK_DAYS), day);
      const skip = vacationDates(settings, day);
      return list.map((habit) =>
        withProgress(
          habit,
          logs.filter((log) => log.habitId === habit.id),
          day,
          skip,
          settings.weekStartsOn,
        ),
      );
    },

    archived: () => base.list(isNotNull(habits.archivedAt), asc(habits.sort)),

    create(input: z.output<typeof habitCreateSchema>): Habit {
      return base.create({
        ...input,
        perWeek: input.schedule === "n_per_week" ? (input.perWeek ?? 1) : null,
        remindAt: input.remindAt ?? null,
        sort: input.sort ?? 0,
        archivedAt: null,
      });
    },

    update(id: string, input: z.output<typeof habitUpdateSchema>): Habit {
      const { archived, ...fields } = input;
      return base.update(id, {
        ...fields,
        ...(archived === undefined ? {} : { archivedAt: archived ? deps.now() : null }),
      });
    },

    /** Check or uncheck a habit for a day; `count` 0 clears it. */
    setLog(habitId: string, date: LocalDate, count: number): HabitLog {
      base.get(habitId);
      const now = deps.now();
      db.insert(habitLogs)
        .values({
          id: `${habitId}:${date}`,
          habitId,
          date,
          count,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: [habitLogs.habitId, habitLogs.date],
          set: { count, updatedAt: now, deletedAt: null },
        })
        .run();
      return db
        .select()
        .from(habitLogs)
        .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
        .get()!;
    },

    logs: (habitId: string, from: LocalDate, to: LocalDate) => logsBetween(habitId, from, to),
  };
}
