import { addDays, startOfWeek } from "@tick-taka/shared/dates";
import { cx } from "@/components/ui/cx";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLocalDate, plural } from "@/lib/format";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { bestText, historyWeeks } from "./habit-progress";
import { type HabitWithProgress, useHabitLogs } from "./queries";

const WEEKS = 12;

/** A saved habit's streak, freeze days and the last twelve weeks, a square per day. */
export function HabitHistory({ habit }: { habit: HabitWithProgress }) {
  const today = useTodayDate();
  const { weekStartsOn } = useUserTime();
  const from = addDays(startOfWeek(today, weekStartsOn), -7 * (WEEKS - 1));
  const logs = useHabitLogs(habit.id, from, today);
  const weeks = historyWeeks(logs.data ?? [], today, WEEKS, weekStartsOn);
  const days = weeks.flat().filter((d) => d !== null);
  const doneDays = days.filter((d) => d.count >= habit.targetCount).length;
  const unit = habit.streak.unit;
  const best = bestText(habit.streak.best, unit);

  return (
    <section aria-labelledby="habit-history-title" className="flex flex-col gap-3">
      <h3 id="habit-history-title" className="text-caption text-muted">
        Streak and history
      </h3>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="text-title text-grape-text tabular">
          {habit.streak.current > 0 ? `🔥 ${plural(habit.streak.current, unit)}` : "A fresh start"}
        </span>
        {best ? <span className="text-callout text-muted">{best}</span> : null}
      </div>
      <p className="text-callout text-muted">
        {plural(habit.streak.freezesLeftThisMonth, "freeze day")} left this month
        {habit.streak.freezesUsedThisMonth > 0
          ? ` · ${habit.streak.freezesUsedThisMonth} used to keep the streak`
          : ""}
      </p>
      {logs.data === undefined ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <div className="flex flex-col gap-2">
          {/* Days run down each column, weeks left to right, the newest at the end. */}
          <div
            role="img"
            aria-label={`Done on ${plural(doneDays, "day")} of the last ${days.length}`}
            className="grid grid-flow-col grid-rows-7 gap-1 self-start"
          >
            {weeks.flatMap((week) =>
              week.map((day, i) =>
                day ? (
                  <span
                    key={day.date}
                    title={`${formatLocalDate(day.date)}: ${day.count}/${habit.targetCount}`}
                    className={cx(
                      "size-3.5 rounded-[3px]",
                      day.count >= habit.targetCount
                        ? "bg-grape-text"
                        : day.count > 0
                          ? "border-2 border-grape-text"
                          : "bg-line",
                    )}
                  />
                ) : (
                  // biome-ignore lint/suspicious/noArrayIndexKey: days still to come this week
                  <span key={`future-${i}`} className="size-3.5" />
                ),
              ),
            )}
          </div>
          <p aria-hidden className="flex gap-3 text-caption text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="size-2.5 rounded-[2px] bg-grape-text" /> Done
            </span>
            {habit.targetCount > 1 ? (
              <span className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-[2px] border-2 border-grape-text" /> Some
              </span>
            ) : null}
            <span>{plural(doneDays, "day")} in 12 weeks</span>
          </p>
        </div>
      )}
    </section>
  );
}
