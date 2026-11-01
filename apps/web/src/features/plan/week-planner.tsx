import { Link } from "@tanstack/react-router";
import { addDays, endOfLocalDay, startOfLocalDay, toLocalDate } from "@tick-taka/shared/dates";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { ErrorState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLocalDate, formatMinutes } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useSettings } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { CompactTask, type PlanAction } from "./compact-task";
import { Draggable, DropArea, PlanDnd } from "./plan-dnd";
import { type PlanTask, useTasks } from "./queries";
import { useMoveTask } from "./use-move-task";

const DEFAULT_TASK_MINUTES = 30;

/** Drag tasks onto days; a day's name opens it as a timeline. */
export function WeekPlanner({
  weekStart,
  thisWeek,
  onWeekChange,
}: {
  weekStart: string;
  thisWeek: string;
  onWeekChange: (weekStart: string) => void;
}) {
  const { timeZone } = useUserTime();
  const { data: settings } = useSettings();
  const today = useTodayDate();
  const open = useOpenPanel();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const week = useTasks({
    status: "inbox,open,done",
    from: String(startOfLocalDay(weekStart, timeZone)),
    to: String(endOfLocalDay(addDays(weekStart, 6), timeZone)),
  });
  const unscheduled = useTasks({ status: "inbox,open" });
  const move = useMoveTask(timeZone);
  // One map of both lists, so a moved task shows in its new place at once.
  const all = new Map<string, PlanTask>(
    [...(unscheduled.data ?? []), ...(week.data ?? [])].map((t) => [t.id, t]),
  );
  const tray = [...all.values()].filter((t) => t.doAt === null && t.status !== "done");
  const capacity = settings?.dayCapacityMinutes ?? 360;

  // The same moves a drag makes, for the keyboard and screen readers.
  const scheduleActions = (task: PlanTask): PlanAction[] => [
    { label: "Schedule for today", run: () => move.toDay(task, today) },
    { label: "Schedule for tomorrow", run: () => move.toDay(task, addDays(today, 1)) },
    {
      label: "Schedule for a date",
      pick: "date",
      initial: task.doAt !== null ? toLocalDate(task.doAt, timeZone) : today,
      onPick: (date) => move.toDay(task, date),
    },
    ...(task.doAt !== null ? [{ label: "Unschedule", run: () => move.unschedule(task) }] : []),
  ];

  const onDrop = (taskId: string, zone: string) => {
    const task = all.get(taskId);
    if (!task) return;
    if (zone === "tray") {
      if (task.doAt !== null) move.unschedule(task);
    } else if (task.doAt === null || toLocalDate(task.doAt, timeZone) !== zone)
      move.toDay(task, zone);
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Week"
        subtitle={`${formatLocalDate(weekStart)} – ${formatLocalDate(addDays(weekStart, 6))}`}
        actions={
          <>
            <IconButton
              icon={ChevronLeft}
              label="Previous week"
              onClick={() => onWeekChange(addDays(weekStart, -7))}
            />
            <Button
              size="sm"
              disabled={weekStart === thisWeek}
              onClick={() => onWeekChange(thisWeek)}
            >
              This week
            </Button>
            <IconButton
              icon={ChevronRight}
              label="Next week"
              onClick={() => onWeekChange(addDays(weekStart, 7))}
            />
          </>
        }
      />
      <PlanDnd
        onDrop={onDrop}
        renderOverlay={(id) => {
          const task = all.get(id);
          return task ? <CompactTask task={task} preview tone="neutral" /> : null;
        }}
      >
        <DropArea
          id="tray"
          label="Unscheduled"
          className="flex flex-col gap-3 rounded-2xl border border-dashed border-line-strong/50 p-3"
        >
          <p className="px-1 text-caption text-muted">Unscheduled · drag onto a day</p>
          {unscheduled.data === undefined ? (
            <Skeleton className="h-11 w-full rounded-xl" />
          ) : tray.length === 0 ? (
            <p className="px-1 text-callout text-muted">Nothing waiting.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {tray.map((task) => (
                <li key={task.id}>
                  <Draggable id={task.id}>
                    <CompactTask task={task} tone="neutral" actions={scheduleActions(task)} />
                  </Draggable>
                </li>
              ))}
            </ul>
          )}
        </DropArea>
        {week.isError && !week.data ? (
          <ErrorState onRetry={() => void week.refetch()} />
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2">
            {days.map((day) => {
              const tasks = [...all.values()].filter(
                (t) => t.doAt !== null && toLocalDate(t.doAt, timeZone) === day,
              );
              const planned = tasks
                .filter((t) => t.status !== "done")
                .reduce((sum, t) => sum + (t.estimateMin ?? DEFAULT_TASK_MINUTES), 0);
              return (
                <DropArea
                  key={day}
                  id={day}
                  label={formatLocalDate(day, "long")}
                  className={cx(
                    "flex min-h-28 flex-col gap-2 rounded-2xl p-2 lg:min-h-[420px]",
                    day === today ? "bg-sky/10" : "bg-card/60",
                  )}
                >
                  <Link
                    to="/plan/day"
                    search={{ date: day }}
                    className="flex flex-col rounded-xl px-1.5 py-1 hover:bg-line/40"
                  >
                    <span
                      className={cx("text-callout font-bold", day === today && "text-sky-text")}
                    >
                      {formatLocalDate(day)}
                    </span>
                    <span className="text-caption text-muted tabular">
                      {planned ? `${formatMinutes(planned)} planned` : "Nothing planned"}
                      {planned > capacity ? " · a full day" : ""}
                    </span>
                  </Link>
                  {week.data === undefined ? (
                    <Skeleton className="h-12 w-full rounded-xl" />
                  ) : (
                    <ul className="flex flex-col gap-1.5">
                      {tasks.map((task) => (
                        <li key={task.id}>
                          <Draggable id={task.id}>
                            <CompactTask task={task} actions={scheduleActions(task)} />
                          </Draggable>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={() => open("task:new", { doDate: day })}
                    aria-label={`Add a task on ${formatLocalDate(day, "long")}`}
                    className="mt-auto flex h-8 items-center gap-1.5 rounded-xl px-1.5 text-callout font-semibold text-muted hover:bg-line/40 hover:text-ink"
                  >
                    <Plus aria-hidden className="size-4" />
                    Add
                  </button>
                </DropArea>
              );
            })}
          </div>
        )}
      </PlanDnd>
    </div>
  );
}
