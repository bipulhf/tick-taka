import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

type TaskQuery = Parameters<typeof api.tasks.$get>[0]["query"];

/** Tasks matching a list query; the first key segment is "tasks", so task writes refresh it. */
export function useTasks(query: TaskQuery, enabled = true) {
  return useQuery({
    queryKey: ["tasks", query],
    queryFn: () => unwrap(api.tasks.$get({ query })),
    enabled,
  });
}

export type PlanTask = NonNullable<ReturnType<typeof useTasks>["data"]>[number];

/**
 * Projects of every status, all of them or one area's. Keyed apart from the task
 * panel's active-only list (["projects", areaId]) so the two never share a cache entry.
 */
export function useAllProjects(areaId?: string) {
  return useQuery({
    queryKey: ["projects", "all", areaId ?? null],
    queryFn: () => unwrap(api.projects.$get({ query: areaId ? { areaId } : {} })),
  });
}

export type Project = NonNullable<ReturnType<typeof useAllProjects>["data"]>[number];

/** Bills and paydays, for the calendar's marks (the money views use the same key). */
export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => unwrap(api.recurring.$get()) });
}

export type RecurringItem = NonNullable<ReturnType<typeof useRecurring>["data"]>[number];

/**
 * Every area's hours this week, money in and out this month and open tasks
 * (GET /insights/areas); the area page's header shows its own row.
 */
export const useAreaSummaries = () =>
  useQuery({
    queryKey: ["area-dashboard"],
    queryFn: () => unwrap(api.insights.areas.$get({ query: {} })),
  });
