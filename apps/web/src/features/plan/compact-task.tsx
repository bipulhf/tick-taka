import { MoreHorizontal } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cx } from "@/components/ui/cx";
import { DateField, TimeField } from "@/components/ui/date-field";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { formatClock, formatMinutes } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useRowKeyActions } from "@/lib/row-keys";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import type { PlanTask } from "./queries";

/**
 * What a drag does, offered in the card's menu as well, so it never needs a mouse.
 * A `pick` action asks for a day or a time inline before it runs.
 */
export type PlanAction =
  | { label: string; run: () => void }
  | {
      label: string;
      pick: "date" | "time";
      initial: string;
      onPick: (value: string) => void;
    };

/**
 * A slim task card for planners: check, title, time and estimate, and a menu with
 * the moves. Clicking opens the task; dragging it (see plan-dnd.tsx) schedules it.
 * Sky when it has a time or a day in a planner, neutral while it has none.
 */
export function CompactTask({
  task,
  tone = "sky",
  actions = [],
  preview = false,
}: {
  task: PlanTask;
  tone?: "sky" | "neutral";
  actions?: PlanAction[];
  /** The copy that follows the pointer during a drag: no keys, no menu. */
  preview?: boolean;
}) {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const open = useOpenPanel();
  const taskActions = useTaskActions();
  const [picking, setPicking] = useState<Extract<PlanAction, { pick: string }> | null>(null);
  const [value, setValue] = useState("");
  const field = useRef<HTMLDivElement>(null);
  const done = task.status === "done";
  const key = `task:${task.id}`;
  const keyActions = useMemo(
    () => ({
      toggle: () => taskActions.toggleDone(task),
      star: () => taskActions.toggleTopThree(task, today),
      remove: () => taskActions.remove(task),
    }),
    [taskActions, task, today],
  );
  useRowKeyActions(preview ? undefined : key, keyActions);

  useEffect(() => {
    if (!picking) return;
    // After the menu has handed focus back to its button.
    const timer = setTimeout(() => field.current?.querySelector("input")?.focus(), 60);
    return () => clearTimeout(timer);
  }, [picking]);

  const meta = [
    task.hasTime && task.doAt !== null ? formatClock(task.doAt, timeZone) : null,
    task.estimateMin ? formatMinutes(task.estimateMin) : null,
    task.rrule ? "↻" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      data-row={preview ? undefined : key}
      className={cx(
        "group/row relative flex flex-col gap-2 rounded-xl px-2.5 py-2 transition-colors duration-150",
        tone === "sky"
          ? "bg-[color-mix(in_oklab,var(--tt-sky)_13%,var(--tt-card))] hover:bg-[color-mix(in_oklab,var(--tt-sky)_19%,var(--tt-card))]"
          : "border border-line bg-card hover:bg-line/30",
      )}
    >
      <div className="flex items-start gap-2">
        <span className="relative z-10 pt-0.5">
          <Checkbox
            size="sm"
            checked={done}
            onChange={() => taskActions.toggleDone(task)}
            label={done ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
          />
        </span>
        <button
          type="button"
          data-row-primary
          onClick={() => open(`task:${task.id}`)}
          className={cx(
            "min-w-0 flex-1 text-left after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:outline-none after:focus-visible:ring-2 after:focus-visible:ring-sky-text",
          )}
        >
          {/* Room for the menu button on the first line only. */}
          {actions.length > 0 && !preview ? (
            <span aria-hidden className="float-right h-5 w-5" />
          ) : null}
          <span
            className={cx(
              "block text-callout font-semibold break-words",
              done && "text-muted line-through decoration-line-strong",
            )}
          >
            {task.title}
          </span>
          {meta ? <span className="block text-caption text-muted tabular">{meta}</span> : null}
        </button>
        {actions.length > 0 && !preview ? (
          <span className="absolute top-1 right-1 z-10">
            <Menu
              items={actions.map((action) => ({
                label: action.label,
                onSelect: () => {
                  if ("run" in action) return action.run();
                  setValue(action.initial);
                  setPicking(action);
                },
              }))}
              trigger={
                <IconButton
                  icon={MoreHorizontal}
                  label={`Move “${task.title}”`}
                  size="sm"
                  tooltip={false}
                  className="size-7 [@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
                />
              }
            />
          </span>
        ) : null}
      </div>
      {picking ? (
        <form
          className="relative z-10 flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (value) picking.onPick(value);
            setPicking(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              setPicking(null);
            }
          }}
        >
          <div ref={field} className="min-w-32 flex-1">
            {picking.pick === "date" ? (
              <DateField label={picking.label} value={value} onChange={(v) => setValue(v ?? "")} />
            ) : (
              <TimeField label={picking.label} value={value} onChange={(v) => setValue(v ?? "")} />
            )}
          </div>
          <Button type="submit" size="sm" disabled={!value}>
            Set
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setPicking(null)}>
            Cancel
          </Button>
        </form>
      ) : null}
    </div>
  );
}
