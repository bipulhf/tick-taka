import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";
import { useToday } from "@/lib/use-today";

/** Habits with their progress on `date`, by default today in the user's time zone. */
export function useHabits(date?: string) {
  const today = useToday();
  const day = date ?? today;
  return useQuery({
    queryKey: ["habits", day],
    queryFn: () => unwrap(api.habits.$get({ query: { date: day } })),
  });
}

export type HabitWithProgress = NonNullable<ReturnType<typeof useHabits>["data"]>[number];
