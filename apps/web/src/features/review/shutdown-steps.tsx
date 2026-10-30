import { useQueryClient } from "@tanstack/react-query";
import { CalendarArrowUp, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TaskRow } from "@/features/tasks/task-row";
import { movedMessage, type TaskBefore, undoMoves } from "@/features/today/bulk-move";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { notify } from "@/lib/toast";
import { fire } from "@/lib/write";
import { type ShutdownData, useDoneOn, useUnfinishedBy } from "./queries";
import { carriedTo } from "./shutdown-progress";

export type Habit = ShutdownData["habitsUnchecked"][number];
export type Candidate = ShutdownData["tomorrowCandidates"][number];

/** A row whose whole width ticks its check; the check stays the screen-reader control. */
function CheckRow({
  checked,
  label,
  onChange,
  tone,
  children,
  muted,
}: {
  checked: boolean;
  label: string;
  onChange: () => void;
  tone?: "sky" | "grape";
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <li>
      {/* biome-ignore lint/a11y/noLabelWithoutControl: the control is the Checkbox button inside */}
      <label className="flex min-h-[52px] cursor-pointer items-center gap-3 px-4 py-2 hover:bg-line/30">
        <Checkbox checked={checked} label={label} tone={tone} onChange={onChange} />
        <span className={cx("line-clamp-2 flex-1 text-body", muted && "text-muted")}>
          {children}
        </span>
      </label>
    </li>
  );
}

function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <SkeletonRows rows={rows} />
    </div>
  );
}

/** Step 1: what got done, said as a win. Rows can still be unticked. */
export function DoneTodayStep({ date, timeZone }: { date: string; timeZone: string }) {
  const done = useDoneOn(date, timeZone);
  if (!done.data)
    return done.isError ? <ErrorState onRetry={() => void done.refetch()} /> : <Loading />;
  if (done.data.length === 0)
    return (
      <EmptyState
        title="A quiet day"
        message="Nothing ticked off today, and that's fine. Tomorrow is a fresh start."
        mood="relaxed"
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-callout text-muted">
        {plural(done.data.length, "task")} finished. Nice work.
      </p>
      <Group as="ul" label="Done today">
        {done.data.map((task) => (
          <TaskRow key={task.id} task={task} as="li" />
        ))}
      </Group>
    </div>
  );
}

/** Step 2: what's left from today or before moves to tomorrow, one by one or all at once. */
export function CarryOverStep({
  date,
  tomorrow,
  timeZone,
}: {
  date: string;
  tomorrow: string;
  timeZone: string;
}) {
  const client = useQueryClient();
  const unfinished = useUnfinishedBy(date, timeZone);
  const key = ["tasks", "unfinished-by", date];
  const left = (unfinished.data ?? []).filter((t) => t.status !== "done");

  const move = (list: typeof left) => {
    if (list.length === 0) return;
    const ids = new Set(list.map((t) => t.id));
    client.setQueryData<typeof left>(key, (old) => old?.filter((t) => !ids.has(t.id)));
    const before: TaskBefore[] = list.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      doAt: t.doAt,
      hasTime: t.hasTime,
      reminderAt: t.reminderAt,
      top3Date: t.top3Date,
    }));
    for (const task of list)
      fire({
        method: "PATCH",
        path: `/tasks/${task.id}`,
        body: carriedTo(task, tomorrow, timeZone),
        label: `Couldn't move “${task.title}”`,
      });
    notify(movedMessage(before, "tomorrow"), {
      label: "Undo",
      onPress: () => {
        for (const request of undoMoves(before)) fire(request);
      },
    });
  };

  if (!unfinished.data)
    return unfinished.isError ? (
      <ErrorState onRetry={() => void unfinished.refetch()} />
    ) : (
      <Loading />
    );
  if (left.length === 0)
    return (
      <EmptyState
        title="Nothing left over"
        message="Everything planned for today is done or has a new day."
        mood="proud"
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-callout text-muted">
          {plural(left.length, "task")} still open. Tick what you did, move the rest.
        </p>
        <Button size="sm" variant="time" icon={CalendarArrowUp} onClick={() => move(left)}>
          Move all to tomorrow
        </Button>
      </div>
      <Group as="ul" label="Still open">
        {left.map((task) => (
          <li key={task.id} className="flex items-center">
            <div className="min-w-0 flex-1">
              <TaskRow task={task} showWhen as="div" />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mr-2"
              aria-label={`Move “${task.title}” to tomorrow`}
              onClick={() => move([task])}
            >
              Tomorrow
            </Button>
          </li>
        ))}
      </Group>
    </div>
  );
}

/** Step 3: daily habits not ticked yet. Ticked ones stay listed so a tick can be undone. */
export function HabitsStep({
  habits,
  ticked,
  onTick,
  onUntick,
}: {
  habits: Habit[];
  ticked: Habit[];
  onTick: (habit: Habit) => void;
  onUntick: (habit: Habit) => void;
}) {
  if (habits.length === 0 && ticked.length === 0)
    return (
      <EmptyState
        title="All habits checked"
        message="Lovely. Nothing left to tick off today."
        mood="proud"
      />
    );
  return (
    <div className="flex flex-col gap-3">
      {habits.length ? (
        <Group as="ul" label="Habits to tick">
          {habits.map((habit) => (
            <CheckRow
              key={habit.id}
              checked={false}
              tone="grape"
              label={habit.name}
              onChange={() => onTick(habit)}
            >
              {habit.emoji} {habit.name}
            </CheckRow>
          ))}
        </Group>
      ) : null}
      {ticked.length ? (
        <>
          <h3 className="px-1 text-caption text-muted">Done</h3>
          <Group as="ul" label="Habits ticked">
            {ticked.map((habit) => (
              <CheckRow
                key={habit.id}
                checked
                tone="grape"
                muted
                label={habit.name}
                onChange={() => onUntick(habit)}
              >
                {habit.emoji} {habit.name}
              </CheckRow>
            ))}
          </Group>
        </>
      ) : null}
    </div>
  );
}

/** Step 4: up to three tasks for tomorrow, picked from what's due by then. */
export function TopThreeStep({
  data,
  onPick,
  onUnpick,
}: {
  data: ShutdownData;
  onPick: (task: Candidate) => void;
  onUnpick: (task: Candidate) => void;
}) {
  const open = useOpenPanel();
  const picked = data.tomorrowTopThree.length;
  if (picked === 0 && data.tomorrowCandidates.length === 0)
    return (
      <EmptyState
        title="Nothing lined up for tomorrow"
        message="Tomorrow is open. Add a task if something comes to mind."
        actionLabel="Add a task"
        onAction={() => open("task:new", { doDate: data.tomorrow })}
        mood="relaxed"
      />
    );
  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-callout text-muted" aria-live="polite">
        {picked}/3 picked
      </p>
      <Group as="ul" label="Tomorrow's top three">
        {data.tomorrowTopThree.map((task) => (
          <CheckRow key={task.id} checked label={task.title} onChange={() => onUnpick(task)}>
            <span aria-hidden>⭐ </span>
            {task.title}
          </CheckRow>
        ))}
        {picked >= 3 ? (
          <li className="px-4 py-3 text-caption text-muted">
            3 of 3 picked. Untick one to swap it.
          </li>
        ) : (
          data.tomorrowCandidates.slice(0, 8).map((task) => (
            <CheckRow
              key={task.id}
              checked={false}
              label={task.title}
              onChange={() => onPick(task)}
            >
              {task.title}
            </CheckRow>
          ))
        )}
      </Group>
    </div>
  );
}

/** Step 5: a nudge to log what was paid in cash and forgotten. */
export function SpendingStep({ logged }: { logged: number }) {
  const open = useOpenPanel();
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl bg-card p-5">
      <p className="text-body text-muted">
        {logged} logged today. Anything paid in cash you forgot?
      </p>
      <Button icon={Plus} onClick={() => open("transaction:new", { type: "expense" })}>
        Log spending
      </Button>
    </div>
  );
}
