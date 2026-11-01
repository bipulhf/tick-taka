import { useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { patchTaskCaches } from "@/features/tasks/use-task-actions";
import { formatClock, formatLocalDate } from "@/lib/format";
import type { TaskRow } from "@/lib/queries";
import { notify } from "@/lib/toast";
import { fire } from "@/lib/write";
import { dayMove, type Movable, SOMEDAY, timeMove, UNSCHEDULE } from "./move-task";
import { previousFields } from "./move-undo";

type Task = Movable & { id: string };

/**
 * Moves a task to another day (keeping its time) or to a minute of a day, at once
 * on screen, with Undo in the toast.
 */
export function useMoveTask(timeZone: string) {
  const client = useQueryClient();
  return useMemo(() => {
    const patch = (task: Task, body: Record<string, unknown>, message: string) => {
      const before = previousFields(task, body);
      patchTaskCaches(client, task.id, body as Partial<TaskRow>);
      fire({ method: "PATCH", path: `/tasks/${task.id}`, body, label: "Couldn't move the task" });
      notify(message, {
        label: "Undo",
        onPress: () => {
          patchTaskCaches(client, task.id, before as Partial<TaskRow>);
          fire({
            method: "PATCH",
            path: `/tasks/${task.id}`,
            body: before,
            label: "Couldn't move the task back",
          });
        },
      });
    };
    return {
      toDay(task: Task, date: string) {
        patch(task, dayMove(task, date, timeZone), `Moved to ${formatLocalDate(date)}`);
      },
      toTime(task: Task, date: string, minuteOfDay: number) {
        const body = timeMove(task, date, minuteOfDay, timeZone);
        patch(task, body, `Moved to ${formatLocalDate(date)}, ${formatClock(body.doAt, timeZone)}`);
      },
      unschedule(task: Task) {
        patch(task, { ...UNSCHEDULE }, "Unscheduled");
      },
      toInbox(task: Task) {
        patch(task, { ...UNSCHEDULE }, "Moved to the inbox");
      },
      toSomeday(task: Task) {
        patch(task, { ...SOMEDAY }, "Parked in Someday");
      },
    };
  }, [client, timeZone]);
}
