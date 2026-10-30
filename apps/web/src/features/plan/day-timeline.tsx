import { addDays, endOfLocalDay, localMinuteOfDay, startOfLocalDay } from "@tick-taka/shared/dates";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate, formatMinutes } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useToday, useTodayDate, useUserTime } from "@/lib/use-today";
import { CompactTask, type PlanAction } from "./compact-task";
import { DayGrid } from "./day-grid";
import { minuteOf } from "./move-task";
import { Draggable, PlanDnd } from "./plan-dnd";
import { PlanMyDay } from "./plan-my-day";
import { type PlanTask, useTasks } from "./queries";
import { minuteFromOffset } from "./timeline-layout";
import { useMoveTask } from "./use-move-task";

const pad = (n: number) => String(n).padStart(2, "0");

/** How full the day is: planned minutes of open tasks against the free time in Settings. */
function DayFit({ date }: { date: string }) {
  const day = useToday(date);
  const fit = day.data?.date === date ? day.data.dayFit : null;
  if (!fit?.capacityMinutes) return null;
  const over = fit.plannedMinutes > fit.capacityMinutes;
  return (
    <div className="flex flex-col gap-1.5 px-1">
      <p className="text-callout text-muted tabular">
        {fit.plannedMinutes
          ? `${formatMinutes(fit.plannedMinutes)} planned of ${formatMinutes(fit.capacityMinutes)}`
          : `${formatMinutes(fit.capacityMinutes)} free, nothing planned yet`}
        {over ? " · a full day" : ""}
      </p>
      <ProgressBar
        value={fit.plannedMinutes / fit.capacityMinutes}
        tone="sky"
        label="Planned time against free time"
        className="h-1.5"
      />
    </div>
  );
}

/** One day as time blocks: drag a task onto an hour, or let AI propose the whole day. */
export function DayTimeline({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const open = useOpenPanel();
  const tasks = useTasks({
    status: "inbox,open,done",
    from: String(startOfLocalDay(date, timeZone)),
    to: String(endOfLocalDay(date, timeZone)),
  });
  const top = useTasks({ top3Date: date });
  const move = useMoveTask(timeZone);

  const all = new Map<string, PlanTask>(
    [...(tasks.data ?? []), ...(top.data ?? [])].map((t) => [t.id, t]),
  );
  const timed = [...all.values()].filter(
    (t): t is PlanTask & { doAt: number } => t.hasTime && t.doAt !== null,
  );
  const untimed = [...all.values()].filter(
    (t) => !(t.hasTime && t.doAt !== null) && t.status !== "done",
  );

  const onDrop = (taskId: string, zone: string, info: { offsetY: number }) => {
    const task = all.get(taskId);
    if (!task || zone !== "grid") return;
    move.toTime(task, date, minuteFromOffset(info.offsetY));
  };
  // Dragging needs a mouse; "Set a time" asks for one instead.
  const actionsFor = (task: PlanTask): PlanAction[] => {
    const minute =
      task.hasTime && task.doAt !== null ? localMinuteOfDay(task.doAt, timeZone) : 9 * 60;
    return [
      {
        label: "Set a time",
        pick: "time",
        initial: `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`,
        onPick: (time) => {
          const at = minuteOf(time);
          if (at !== null) move.toTime(task, date, at);
        },
      },
    ];
  };

  const loading = !tasks.data;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={formatLocalDate(date, "long")}
        subtitle="Drag a task and drop it on a time"
        back={{ to: "/plan", label: "Plan" }}
        actions={
          <>
            <IconButton
              icon={ChevronLeft}
              label="Previous day"
              onClick={() => onDateChange(addDays(date, -1))}
            />
            <Button size="sm" disabled={date === today} onClick={() => onDateChange(today)}>
              Today
            </Button>
            <IconButton
              icon={ChevronRight}
              label="Next day"
              onClick={() => onDateChange(addDays(date, 1))}
            />
          </>
        }
      />
      <div className="flex flex-col gap-3">
        <DayFit date={date} />
        <PlanMyDay date={date} />
      </div>
      {tasks.isError && loading ? (
        <ErrorState onRetry={() => void tasks.refetch()} />
      ) : loading ? (
        <div
          role="status"
          aria-label="Loading"
          className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_320px]"
        >
          <Skeleton className="h-[480px] rounded-2xl" />
          <SkeletonRows rows={3} />
        </div>
      ) : (
        <PlanDnd
          onDrop={onDrop}
          renderOverlay={(id) => {
            const task = all.get(id);
            return task ? <CompactTask task={task} preview tone="neutral" /> : null;
          }}
        >
          <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="order-2 lg:order-1">
              <DayGrid
                timed={timed}
                isToday={date === today}
                timeZone={timeZone}
                actionsFor={actionsFor}
              />
            </div>
            <section
              aria-labelledby="untimed-title"
              className="order-1 flex flex-col gap-3 lg:sticky lg:top-0 lg:order-2"
            >
              <div className="flex min-h-8 items-end justify-between px-1">
                <h2 id="untimed-title" className="text-heading">
                  No time yet
                </h2>
                <Button
                  size="sm"
                  variant="ghost"
                  icon={Plus}
                  onClick={() => open("task:new", { doDate: date })}
                >
                  Add
                </Button>
              </div>
              {untimed.length ? (
                <ul className="flex flex-col gap-2">
                  {untimed.map((task) => (
                    <li key={task.id}>
                      <Draggable id={task.id}>
                        <CompactTask task={task} tone="neutral" actions={actionsFor(task)} />
                      </Draggable>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={CalendarClock}
                  title={all.size === 0 ? "Nothing on this day yet" : "Everything has a time"}
                  message={
                    all.size === 0
                      ? "Tasks for this day show up here, ready to drop onto a time."
                      : "Drag a block to move it, or add another task."
                  }
                />
              )}
            </section>
          </div>
        </PlanDnd>
      )}
    </div>
  );
}
