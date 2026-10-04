import type { QueryClient } from "@tanstack/react-query";
import { keys, type TaskRow, type TodayData } from "./queries";

/** Applies an optimistic change to every cached Today view. */
export function updateToday(client: QueryClient, update: (data: TodayData) => TodayData) {
  for (const [key, data] of client.getQueriesData<TodayData>({ queryKey: ["today"] })) {
    if (data) client.setQueryData(key, update(data));
  }
}

export function patchTaskEverywhere(
  data: TodayData,
  id: string,
  patch: Partial<TaskRow>,
): TodayData {
  const apply = (task: TaskRow) => (task.id === id ? { ...task, ...patch } : task);
  return {
    ...data,
    topThree: data.topThree.map(apply),
    evening: data.evening.map(apply),
    timeline: data.timeline.map((item) =>
      item.kind === "task" ? { ...item, task: apply(item.task) } : item,
    ),
  };
}

export { keys };
