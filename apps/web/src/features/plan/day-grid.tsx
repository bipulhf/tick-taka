import { localMinuteOfDay } from "@tick-taka/shared/dates";
import { cx } from "@/components/ui/cx";
import { useNow } from "@/features/timer/use-now";
import { formatClock } from "@/lib/format";
import type { PlanAction } from "./compact-task";
import { CompactTask } from "./compact-task";
import { Draggable, DropArea } from "./plan-dnd";
import type { PlanTask } from "./queries";
import {
  END_HOUR,
  hourLabel,
  layoutBlocks,
  offsetOf,
  PX_PER_MIN,
  START_HOUR,
} from "./timeline-layout";

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
const GUTTER = "4.75rem";

/** The hours of a day, with timed tasks placed by their time and a line at "now" today. */
export function DayGrid({
  timed,
  isToday,
  timeZone,
  actionsFor,
}: {
  timed: (PlanTask & { doAt: number })[];
  isToday: boolean;
  timeZone: string;
  actionsFor: (task: PlanTask) => PlanAction[];
}) {
  const now = useNow(60_000, isToday);
  const byId = new Map(timed.map((task) => [task.id, task]));
  const blocks = layoutBlocks(
    timed.map((task) => ({
      id: task.id,
      start: localMinuteOfDay(task.doAt, timeZone),
      minutes: task.estimateMin,
    })),
  );
  const nowMinute = localMinuteOfDay(now, timeZone);
  const showNow = isToday && nowMinute >= START_HOUR * 60 && nowMinute < END_HOUR * 60;

  return (
    <DropArea
      id="grid"
      label="Hours of the day"
      className="relative rounded-2xl bg-card"
      style={{ height: HOURS.length * 60 * PX_PER_MIN + 8 }}
    >
      {/* The rail: hour lines and fainter half hours, beside a column of hour labels. */}
      <div
        aria-hidden
        className="absolute inset-y-0 left-0 border-r border-line"
        style={{ width: GUTTER }}
      />
      {HOURS.map((hour) => {
        const top = (hour - START_HOUR) * 60 * PX_PER_MIN;
        return (
          <div key={hour} aria-hidden>
            {hour > START_HOUR ? (
              <span
                className="absolute right-0 border-t border-line"
                style={{ top, left: GUTTER }}
              />
            ) : null}
            <span
              className="absolute right-0 border-t border-dashed border-line/70"
              style={{ top: top + 30 * PX_PER_MIN, left: GUTTER }}
            />
            <span
              className={cx(
                "absolute pr-2.5 text-right text-caption text-muted tabular",
                // The now-line names the time; an hour label just beside it would peek out.
                showNow && Math.abs(hour * 60 - nowMinute) < 15 && "invisible",
              )}
              style={{ top: hour === START_HOUR ? 4 : top - 9, left: 0, width: GUTTER }}
            >
              {hourLabel(hour)}
            </span>
          </div>
        );
      })}
      {showNow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: offsetOf(nowMinute) }}
        >
          <span
            className="flex shrink-0 justify-end pr-1.5 -translate-y-px"
            style={{ width: GUTTER }}
          >
            <span className="-my-2.5 rounded-full bg-sky px-1.5 text-caption font-bold whitespace-nowrap text-on-mango tabular">
              {formatClock(now, timeZone)}
            </span>
          </span>
          <span className="-ml-1 size-2 shrink-0 rounded-full bg-sky-text" />
          <span className="h-0.5 flex-1 bg-sky-text" />
        </div>
      ) : null}
      <ul aria-label="Timed tasks" className="contents">
        {blocks.map((block) => {
          const task = byId.get(block.id);
          if (!task) return null;
          const width = `(100% - ${GUTTER} - 0.5rem) / ${block.lanes}`;
          return (
            <li
              key={block.id}
              className="absolute z-10 p-0.5 focus-within:z-30 hover:z-30"
              style={{
                top: block.top + 2,
                height: block.height - 2,
                left: `calc(${GUTTER} + ${width} * ${block.lane})`,
                width: `calc(${width})`,
              }}
            >
              <Draggable id={task.id} className="h-full">
                <div className="h-full rounded-xl bg-card [&>div]:min-h-full">
                  <CompactTask task={task} actions={actionsFor(task)} />
                </div>
              </Draggable>
            </li>
          );
        })}
      </ul>
    </DropArea>
  );
}
