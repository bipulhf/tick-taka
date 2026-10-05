import { useQueryClient } from "@tanstack/react-query";
import { notify } from "@/lib/notify";
import { useOutbox } from "@/lib/outbox";
import type { TaskRow } from "@/lib/queries";
import { playSound } from "@/lib/sounds";
import { patchTaskEverywhere, updateToday } from "@/lib/today-cache";

type TaskLike = Pick<TaskRow, "id" | "title" | "status" | "top3Date" | "doAt"> & {
  parentId?: string | null;
};

/** Task writes with optimistic Today updates; every change is queued in the offline outbox. */
export function useTaskActions() {
  const client = useQueryClient();
  const send = useOutbox();

  const patch = (task: TaskLike, changes: Partial<TaskRow>, label: string) => {
    updateToday(client, (data) => patchTaskEverywhere(data, task.id, changes));
    send({
      method: "PATCH",
      path: `/tasks/${task.id}`,
      body: { ...changes, updatedAt: Date.now() },
      label,
    });
  };

  return {
    toggleDone(task: TaskLike) {
      const done = task.status !== "done";
      patch(
        task,
        { status: done ? "done" : "open", doneAt: done ? Date.now() : null },
        "Couldn't update the task",
      );
      // A subtask is a small step; finishing a task gets the full chime.
      if (done) playSound(task.parentId ? "pop" : "done");
    },
    snooze(task: TaskLike) {
      const doAt = (task.doAt ?? Date.now()) + 86_400_000;
      patch(task, { doAt }, "Couldn't snooze");
      notify(`“${task.title}” moved to tomorrow`, {
        label: "Undo",
        onPress: () => patch(task, { doAt: task.doAt }, "Couldn't undo"),
      });
    },
    setTopThree(task: TaskLike, date: string | null) {
      patch(task, { top3Date: date }, "Couldn't update top three");
    },
    remove(task: TaskLike) {
      send({ method: "DELETE", path: `/tasks/${task.id}`, label: "Couldn't delete" });
      notify(`Deleted “${task.title}”`, {
        label: "Undo",
        onPress: () =>
          send({ method: "POST", path: `/tasks/${task.id}/restore`, label: "Couldn't undo" }),
      });
    },
  };
}
