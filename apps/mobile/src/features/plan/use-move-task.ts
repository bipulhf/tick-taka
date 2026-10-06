import {
  localParts,
  parseLocalDate,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { formatClock, formatLocalDate } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import { editTime } from "@/lib/server-clock";
import { previousFields } from "./move-undo";
import type { PlanTask } from "./queries";

/** Moves a task to another day (keeping its time) or to a specific minute of a day. */
export function useMoveTask(timeZone: string) {
  const send = useOutbox();
  const patch = (task: PlanTask, body: Record<string, unknown>, message: string) => {
    const before = previousFields(task, body);
    send({
      method: "PATCH",
      path: `/tasks/${task.id}`,
      body: { ...body, updatedAt: editTime() },
      label: "Couldn't move the task",
    });
    notify(message, {
      label: "Undo",
      onPress: () =>
        send({
          method: "PATCH",
          path: `/tasks/${task.id}`,
          body: { ...before, updatedAt: editTime() },
          label: "Couldn't move the task back",
        }),
    });
  };

  return {
    toDay(task: PlanTask, date: string) {
      let doAt = startOfLocalDay(date, timeZone);
      if (task.hasTime && task.doAt !== null) {
        const { hour, minute } = localParts(task.doAt, timeZone);
        doAt = zonedTimeToUtc({ ...parseLocalDate(date), hour, minute }, timeZone);
      }
      const shift = task.doAt === null ? 0 : doAt - task.doAt;
      patch(
        task,
        {
          doAt,
          status: task.status === "inbox" || task.status === "someday" ? "open" : task.status,
          reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
        },
        `Moved to ${formatLocalDate(date)}`,
      );
    },
    toTime(task: PlanTask, date: string, minuteOfDay: number) {
      const doAt = zonedTimeToUtc(
        { ...parseLocalDate(date), hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 },
        timeZone,
      );
      patch(
        task,
        {
          doAt,
          hasTime: true,
          reminderAt: doAt,
          status: task.status === "done" ? "done" : "open",
        },
        `Moved to ${formatLocalDate(date)}, ${formatClock(doAt, timeZone)}`,
      );
    },
    unschedule(task: PlanTask) {
      patch(task, { doAt: null, hasTime: false, reminderAt: null, status: "inbox" }, "Unscheduled");
    },
  };
}
