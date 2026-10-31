import { AlarmClock, Flag, MoreHorizontal, Sparkles, Star, StarOff, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Row } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { askTikiAbout } from "@/features/assistant/ask-tiki";
import { useAssistantAvailable } from "@/features/assistant/assistant-button";
import { formatMinutes, formatWhen } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import type { TaskRow as Task } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { useTaskActions } from "./use-task-actions";

export interface TaskRowProps {
  task: Task;
  size?: "md" | "lg";
  /** Says when it's planned ("Today, 5:00 pm"), for lists that mix days. */
  showWhen?: boolean;
  areaEmoji?: string;
  as?: "div" | "li";
}

const DEADLINE_WARN_MS = 3 * 86_400_000;

/**
 * A task in any list: the round check, the title, a line of meta and a flag for
 * high priority. The row opens the task panel; Snooze, Top three and Delete sit in
 * a menu at its end, and on keys while it has focus: X completes, T stars, Delete removes.
 */
export function TaskRow({ task, size = "md", showWhen = false, areaEmoji, as }: TaskRowProps) {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const open = useOpenPanel();
  const actions = useTaskActions();
  const tiki = useAssistantAvailable();
  const done = task.status === "done";
  const now = Date.now();
  const deadlineSoon =
    task.deadlineAt !== null && !done && task.deadlineAt - now < DEADLINE_WARN_MS;
  const meta = [
    showWhen && task.doAt !== null ? formatWhen(task.doAt, task.hasTime, now, timeZone) : null,
    task.estimateMin ? formatMinutes(task.estimateMin) : null,
    task.rrule ? "↻" : null,
  ].filter(Boolean);
  const inTopThree = task.top3Date === today;
  const keyActions = useMemo(
    () => ({
      toggle: () => actions.toggleDone(task),
      star: () => actions.toggleTopThree(task, today),
      remove: () => actions.remove(task),
    }),
    [actions, task, today],
  );

  return (
    <Row
      as={as}
      dataKey={`task:${task.id}`}
      keyActions={keyActions}
      onClick={() => open(`task:${task.id}`)}
      muted={done}
      className={size === "lg" ? "min-h-[60px]" : undefined}
      leading={
        <Checkbox
          checked={done}
          onChange={() => actions.toggleDone(task)}
          size={size === "lg" ? "md" : "sm"}
          label={done ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
        />
      }
      title={
        <>
          {areaEmoji ? <span aria-hidden>{areaEmoji} </span> : null}
          {task.title}
        </>
      }
      subtitle={
        meta.length || deadlineSoon ? (
          <>
            {meta.join(" · ")}
            {deadlineSoon && task.deadlineAt ? (
              <span className="text-ink">
                {meta.length ? " · " : ""}
                Due {formatWhen(task.deadlineAt, false, now, timeZone)}
              </span>
            ) : null}
          </>
        ) : undefined
      }
      trailing={
        <>
          {task.priority === "high" ? (
            <span className="inline-flex items-center text-ink">
              <Flag aria-hidden className="size-4" strokeWidth={2.4} />
              <span className="sr-only">High priority</span>
            </span>
          ) : null}
          <Menu
            items={[
              {
                label: "Snooze",
                icon: AlarmClock,
                onSelect: () => actions.snooze(task),
              },
              {
                label: inTopThree ? "Take off top three" : "Add to top three",
                icon: inTopThree ? StarOff : Star,
                shortcut: "T",
                onSelect: () => actions.toggleTopThree(task, today),
              },
              ...(tiki
                ? [
                    {
                      label: "Ask Tiki about this",
                      icon: Sparkles,
                      onSelect: () =>
                        askTikiAbout({ kind: "task", id: task.id, title: task.title }),
                    } satisfies MenuItem,
                  ]
                : []),
              "separator",
              {
                label: "Delete",
                icon: Trash2,
                danger: true,
                shortcut: "Del",
                onSelect: () => actions.remove(task),
              },
            ]}
            trigger={
              <IconButton
                icon={MoreHorizontal}
                label={`More for “${task.title}”`}
                size="sm"
                tooltip={false}
                className="[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              />
            }
          />
        </>
      }
    />
  );
}
