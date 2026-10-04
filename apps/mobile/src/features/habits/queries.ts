import { useQuery } from "@tanstack/react-query";
import { toLocalDate } from "@tick-taka/shared/dates";
import { api, unwrap } from "@/lib/api";

export function useHabits(date = toLocalDate(Date.now())) {
  return useQuery({
    queryKey: ["habits", date],
    queryFn: () => unwrap(api.habits.$get({ query: { date } })),
  });
}

export type HabitWithProgress = NonNullable<ReturnType<typeof useHabits>["data"]>[number];
