import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export function useTimeEntries(from: number, to: number) {
  return useQuery({
    queryKey: ["time-entries", from, to],
    queryFn: () =>
      unwrap(api["time-entries"].$get({ query: { from: String(from), to: String(to) } })),
  });
}

export function useRunningTimer() {
  return useQuery({ queryKey: ["timer"], queryFn: () => unwrap(api.timer.$get()) });
}

export function useFocusStats(from: number, to: number) {
  return useQuery({
    queryKey: ["focus-stats", from, to],
    queryFn: () =>
      unwrap(
        api["time-entries"]["focus-stats"].$get({ query: { from: String(from), to: String(to) } }),
      ),
  });
}
