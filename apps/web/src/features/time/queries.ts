import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

/** Time entries that started in [from, to); the time-entry panel finds an entry to edit here. */
export function useTimeEntries(from: number, to: number) {
  return useQuery({
    queryKey: ["time-entries", from, to],
    queryFn: () =>
      unwrap(api["time-entries"].$get({ query: { from: String(from), to: String(to) } })),
  });
}

export type TimeEntry = NonNullable<ReturnType<typeof useTimeEntries>["data"]>[number];

export function useFocusStats(from: number, to: number) {
  return useQuery({
    queryKey: ["focus-stats", from, to],
    queryFn: () =>
      unwrap(
        api["time-entries"]["focus-stats"].$get({ query: { from: String(from), to: String(to) } }),
      ),
  });
}
