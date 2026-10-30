import { localMinuteOfDay } from "@tick-taka/shared/dates";
import { useNow } from "@/features/timer/use-now";
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
const GUTTER = "4.25rem";

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
      {HOURS.map((hour) => (
        <div
          key={hour}
          aria-hidden
          className="absolute inset-x-0 flex border-t border-line first:border-t-0"
          style={{ top: (hour - START_HOUR) * 60 * PX_PER_MIN }}
        >
          <span className="w-[4.25rem] pt-1 pl-3 text-caption text-muted tabular">
            {hourLabel(hour)}
          </span>
        </div>
      ))}
      {showNow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-2 z-[5] flex items-center"
          style={{ top: offsetOf(nowMinute), left: `calc(${GUTTER} - 5px)` }}
        >
          <span className="size-2.5 rounded-full bg-sky-text" />
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
