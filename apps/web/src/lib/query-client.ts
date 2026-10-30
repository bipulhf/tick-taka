import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api";
import { keysToRefresh } from "./invalidation";

let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
let changedPaths = new Set<string>();

/**
 * After writes land, refresh the views they can change, once, 250 ms after the
 * last one. A write to an unknown route refreshes everything.
 */
export function scheduleRefresh(path = "/") {
  changedPaths.add(path);
  clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => {
    const keys = keysToRefresh(changedPaths);
    changedPaths = new Set();
    if (keys === "all") void queryClient.invalidateQueries();
    else
      void queryClient.invalidateQueries({
        predicate: (query) => keys.has(String(query.queryKey[0])),
      });
  }, 250);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // A refusal (4xx) won't change on a retry; a server or network hiccup might.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});
