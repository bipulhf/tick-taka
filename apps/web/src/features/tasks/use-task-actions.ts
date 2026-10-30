import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { keys, type TaskRow, type TodayData } from "@/lib/queries";
import { playSound } from "@/lib/sounds";
import { notify } from "@/lib/toast";
import { patchTaskEverywhere, updateToday } from "@/lib/today-cache";
import { fire, remove } from "@/lib/write";

export type TaskLike = Pick<TaskRow, "id" | "title" | "status" | "top3Date" | "doAt"> & {
  parentId?: string | null;
};

type Patch = Partial<TaskRow>;

interface WithSubtasks {
  id: string;
  subtasks?: { id: string }[];
}

/**
 * Applies a change to every cached copy of a task: Today, task lists (["tasks", …])
 * and open task panels (["task", id], including a parent's subtask list).
 */
export function patchTaskCaches(client: QueryClient, id: string, changes: Patch) {
  updateToday(client, (data) => patchTaskEverywhere(data, id, changes));
  client.setQueriesData<{ id: string }[]>({ queryKey: ["tasks"] }, (old) =>
    Array.isArray(old) ? old.map((task) => (task.id === id ? { ...task, ...changes } : task)) : old,
  );
  client.setQueriesData<WithSubtasks>({ queryKey: ["task"] }, (old) => {
    if (!old || typeof old !== "object") return old;
    const subtasks = old.subtasks?.map((sub) => (sub.id === id ? { ...sub, ...changes } : sub));
    return old.id === id ? { ...old, ...changes, subtasks } : { ...old, subtasks };
  });
}

/** Drops a deleted task from Today at once; the refresh after the write confirms it. */
function dropFromToday(client: QueryClient, id: string) {
  updateToday(client, (data) => ({
    ...data,
    topThree: data.topThree.filter((t) => t.id !== id),
    evening: data.evening.filter((t) => t.id !== id),
    timeline: data.timeline.filter((item) => item.kind !== "task" || item.task.id !== id),
  }));
}

/** Task writes with optimistic Today updates and Undo toasts, as on the phone. */
export function useTaskActions() {
  const client = useQueryClient();
  return useMemo(() => {
    const patch = (task: TaskLike, changes: Patch, label: string) => {
      patchTaskCaches(client, task.id, changes);
      fire({ method: "PATCH", path: `/tasks/${task.id}`, body: changes, label });
    };
    const setTopThree = (task: TaskLike, date: string | null) =>
      patch(task, { top3Date: date }, "Couldn't update top three");

    return {
      toggleDone(task: TaskLike) {
        const done = task.status !== "done";
        patch(
          task,
          { status: done ? "done" : "open", doneAt: done ? Date.now() : null },
          "Couldn't update the task",
        );
        if (!done) return;
        // A subtask is a small step; finishing a task gets the full chime.
        playSound(task.parentId ? "pop" : "done");
        // A stray click or key can tick the wrong task, so finishing is undoable too.
        notify(`Done: “${task.title}”`, {
          label: "Undo",
          onPress: () => patch(task, { status: task.status, doneAt: null }, "Couldn't undo"),
        });
      },
      snooze(task: TaskLike) {
        const doAt = (task.doAt ?? Date.now()) + 86_400_000;
        patch(task, { doAt }, "Couldn't snooze");
        notify(`“${task.title}” moved to tomorrow`, {
          label: "Undo",
          onPress: () => patch(task, { doAt: task.doAt }, "Couldn't undo"),
        });
      },
      setTopThree,
      /** T on a row: in or out of `date`'s top three, refusing a fourth. */
      toggleTopThree(task: TaskLike, date: string) {
        if (task.top3Date === date) return setTopThree(task, null);
        const day = client.getQueryData<TodayData>(keys.today(date));
        if (day && day.topThree.filter((t) => t.id !== task.id).length >= 3) {
          notify("Top three is full. Swap one out first.");
          return;
        }
        setTopThree(task, date);
      },
      remove(task: TaskLike) {
        dropFromToday(client, task.id);
        void remove(`/tasks/${task.id}`, `“${task.title}”`).catch(() => {});
      },
    };
  }, [client]);
}
