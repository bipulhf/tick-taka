import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import { useTodayDate } from "@/lib/use-today";

/** Habits with their progress on `date` (today by default); archived ones on request. */
export function useHabits(options: { date?: string; archived?: boolean } = {}) {
  const today = useTodayDate();
  const day = options.date ?? today;
  return useQuery({
    queryKey: ["habits", day, options.archived ? "archived" : "active"],
    queryFn: () =>
      unwrap(
        api.habits.$get({
          query: { date: day, ...(options.archived ? { archived: "true" } : {}) },
        }),
      ),
  });
}

export type HabitWithProgress = NonNullable<ReturnType<typeof useHabits>["data"]>[number];

/** One habit's daily counts between two local days, for its history. */
export function useHabitLogs(id: string | null, from: string, to: string) {
  return useQuery({
    queryKey: ["habits", "logs", id, from, to],
    queryFn: () =>
      unwrap(api.habits[":id"].logs.$get({ param: { id: id ?? "" }, query: { from, to } })),
    enabled: Boolean(id),
  });
}
