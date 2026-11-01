import { addDays, localMonthRange, toLocalDate } from "@tick-taka/shared/dates";
import { useState } from "react";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLocalDate, formatMonth, plural } from "@/lib/format";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { CalendarDay } from "./calendar-day";
import { calendarCells, occurrencesByDate, weekdayHeaders } from "./calendar-marks";
import { type PlanTask, useRecurring, useTasks } from "./queries";

const WEEK_MS = 7 * 86_400_000;

/**
 * The month with tasks and bills together (the Week planner does weeks): each day says
 * how many tasks are open, today is ringed, and the picked day's list sits beside the
 * grid at desk width. The marks differ by shape as well as colour (DESIGN.md): tasks a
 * dot with their count, a ring when some are at a set time, bills a square.
 */
export function CalendarView() {
  const { timeZone, weekStartsOn } = useUserTime();
  const today = useTodayDate();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const range = localMonthRange(month, timeZone);
  const tasks = useTasks({
    status: "inbox,open,done",
    from: String(range.from - WEEK_MS),
    to: String(range.to + WEEK_MS),
  });
  const recurring = useRecurring();
  const bills = occurrencesByDate(recurring.data ?? [], month);
  const byDay = new Map<string, PlanTask[]>();
  for (const task of tasks.data ?? []) {
    if (task.doAt === null) continue;
    const day = toLocalDate(task.doAt, timeZone);
    byDay.set(day, [...(byDay.get(day) ?? []), task]);
  }
  const cells = calendarCells(month, weekStartsOn);

  const select = (date: string) => {
    setSelected(date);
    if (date.slice(0, 7) !== month) setMonth(date.slice(0, 7));
  };
  // Arrow keys move the selected day, as in a date picker.
  const onKey = (event: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = addDays(selected, step);
    select(next);
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-calendar-day="${next}"]`)?.focus(),
    );
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={formatMonth(month)}
        actions={
          <MonthStepper
            month={month}
            onChange={(next) => {
              setMonth(next);
              setSelected(next === today.slice(0, 7) ? today : `${next}-01`);
            }}
          />
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-3">
          {tasks.isError && !tasks.data ? (
            <ErrorState onRetry={() => void tasks.refetch()} />
          ) : (
            <div className="-mx-3 rounded-3xl bg-card px-1 py-3 sm:mx-0 sm:px-3">
              <div aria-hidden className="grid grid-cols-7 pb-1">
                {weekdayHeaders(weekStartsOn).map((day) => (
                  <span key={day.name} className="text-center text-caption text-muted">
                    {day.letter}
                  </span>
                ))}
              </div>
              {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the day buttons inside */}
              <div className="grid grid-cols-7" onKeyDown={onKey}>
                {cells.map((date) => {
                  const dayTasks = byDay.get(date) ?? [];
                  const open = dayTasks.filter((t) => t.status !== "done").length;
                  const timed = dayTasks.some((t) => t.hasTime);
                  const hasBills = (bills.get(date) ?? []).length > 0;
                  const isSelected = date === selected;
                  const inMonth = date.slice(0, 7) === month;
                  return (
                    <button
                      key={date}
                      type="button"
                      data-calendar-day={date}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => select(date)}
                      aria-pressed={isSelected}
                      aria-current={date === today ? "date" : undefined}
                      aria-label={`${formatLocalDate(date, "long")}, ${plural(open, "task")}${timed ? ", some at a set time" : ""}${hasBills ? ", bills due" : ""}`}
                      className={cx(
                        "flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl py-1.5 transition-colors duration-150 sm:min-h-16",
                        isSelected
                          ? "bg-ink text-background"
                          : date === today
                            ? "ring-2 ring-sky-text ring-inset hover:bg-line/50"
                            : "hover:bg-line/50",
                      )}
                    >
                      {tasks.data === undefined ? (
                        <Skeleton className="h-4 w-5" />
                      ) : (
                        <span
                          className={cx(
                            "text-body font-bold tabular",
                            !isSelected && !inMonth && "text-muted",
                            !isSelected && date === today && "text-sky-text",
                          )}
                        >
                          {Number(date.slice(8))}
                        </span>
                      )}
                      <span aria-hidden className="flex h-4 items-center gap-1">
                        {open > 0 ? (
                          <span
                            className={cx(
                              "inline-flex items-center gap-0.5 text-caption leading-none font-bold tabular",
                              isSelected ? "text-background" : "text-sky-text",
                            )}
                          >
                            <span
                              className={cx(
                                "size-1.5 rounded-full",
                                timed ? "border" : "",
                                timed
                                  ? isSelected
                                    ? "border-background"
                                    : "border-sky-text"
                                  : isSelected
                                    ? "bg-background"
                                    : "bg-sky-text",
                              )}
                            />
                            {open}
                          </span>
                        ) : null}
                        {hasBills ? (
                          <span
                            className={cx(
                              "size-1.5 rounded-[1px]",
                              isSelected ? "bg-background" : "bg-coral-text",
                            )}
                          />
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p aria-hidden className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-caption text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-sky-text" /> Open tasks, with their count
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full border border-sky-text" /> Some at a set time
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-[4px] ring-2 ring-sky-text ring-inset" /> Today
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-[1px] bg-coral-text" /> Bills and paydays
            </span>
          </p>
        </div>
        <CalendarDay
          date={selected}
          tasks={byDay.get(selected) ?? []}
          bills={bills.get(selected) ?? []}
          loading={tasks.data === undefined}
        />
      </div>
    </div>
  );
}
