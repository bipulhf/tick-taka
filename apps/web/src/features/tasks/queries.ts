import { useQuery } from "@tanstack/react-query";
import { addDays, endOfLocalDay } from "@tick-taka/shared/dates";
import { api, unwrap } from "@/lib/api";

/** One task with its subtasks; `null` skips the request. */
export function useTask(id: string | null | undefined) {
  return useQuery({
    queryKey: ["task", id],
    queryFn: () => unwrap(api.tasks[":id"].$get({ param: { id: id ?? "" } })),
    enabled: Boolean(id),
  });
}

export type TaskDetail = NonNullable<ReturnType<typeof useTask>["data"]>;

/** An area's active projects, for the task panel's Project field. */
export function useProjects(areaId: string | null) {
  return useQuery({
    queryKey: ["projects", areaId],
    queryFn: () => unwrap(api.projects.$get({ query: { areaId: areaId ?? "", status: "active" } })),
    enabled: Boolean(areaId),
  });
}

/** Open tasks due within a week of `date`, the pool a top three is picked from. */
export function useTopThreeCandidates(date: string, timeZone: string) {
  return useQuery({
    queryKey: ["tasks", "top3-candidates", date],
    queryFn: () =>
      unwrap(
        api.tasks.$get({
          query: { status: "inbox,open", to: String(endOfLocalDay(addDays(date, 7), timeZone)) },
        }),
      ),
  });
}

/** Every open task, dated or not (the inbox included). */
export function useOpenTasks() {
  return useQuery({
    queryKey: ["tasks", "inbox-undated"],
    queryFn: () => unwrap(api.tasks.$get({ query: { status: "inbox,open" } })),
  });
}

/** Tasks matching what was typed in the palette. */
export function useTaskSearch(q: string) {
  return useQuery({
    queryKey: ["tasks", "search", q],
    queryFn: () => unwrap(api.tasks.$get({ query: { q, limit: "8" } })),
    enabled: q.length >= 2,
    placeholderData: (previous) => previous,
  });
}
