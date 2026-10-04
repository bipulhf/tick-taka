import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

type TaskQuery = Parameters<typeof api.tasks.$get>[0]["query"];

export function useTasks(query: TaskQuery, key: readonly unknown[] = []) {
  return useQuery({
    queryKey: ["tasks", query, ...key],
    queryFn: () => unwrap(api.tasks.$get({ query })),
  });
}

export function useProjects(areaId?: string) {
  return useQuery({
    queryKey: ["projects", areaId ?? "all"],
    queryFn: () => unwrap(api.projects.$get({ query: areaId ? { areaId } : {} })),
  });
}

export function useRecurring() {
  return useQuery({ queryKey: ["recurring"], queryFn: () => unwrap(api.recurring.$get()) });
}

export type PlanTask = NonNullable<ReturnType<typeof useTasks>["data"]>[number];
