import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";
import type { Persister } from "@tanstack/react-query-persist-client";
import { AppState } from "react-native";
import { ApiError } from "./api";
import { keysToRefresh } from "./invalidation";
import { legacyOutboxRequests, type OutboxRequest } from "./outbox-policy";
import { secureStorage } from "./secure-storage";

const DAY_MS = 86_400_000;
const CACHE_KEY = "tt.query-cache";
let invalidateTimer: ReturnType<typeof setTimeout> | undefined;
let changedPaths = new Set<string>();

/**
 * After writes land, refresh the screens they can change, once, 250 ms after the
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
      gcTime: 7 * DAY_MS,
      networkMode: "offlineFirst",
      // Offline with nothing cached, fail at once so the screen says so instead of
      // waiting forever; reconnecting refetches.
      retry: (count, error) =>
        onlineManager.isOnline() && !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

let legacy: Promise<OutboxRequest[]> | null = null;

/**
 * Builds before the outbox had its own storage kept queued writes inside the query
 * cache. Takes them out once, before the cache is restored, so the outbox sends
 * them and they aren't restored as mutations nothing will ever run.
 */
export function takeLegacyOutbox(): Promise<OutboxRequest[]> {
  legacy ??= (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (!raw) return [];
      const cache = JSON.parse(raw) as { clientState?: { mutations?: unknown[] } };
      const requests = legacyOutboxRequests(cache);
      if (cache.clientState?.mutations?.length) {
        cache.clientState.mutations = [];
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      }
      return requests;
    } catch {
      return [];
    }
  })();
  return legacy;
}

const cachePersister = createAsyncStoragePersister({
  // Balances, transactions and notes: encrypted at rest.
  storage: secureStorage,
  key: CACHE_KEY,
  throttleTime: 1000,
});

export const persister: Persister = {
  persistClient: cachePersister.persistClient,
  removeClient: cachePersister.removeClient,
  restoreClient: async () => {
    await takeLegacyOutbox();
    return cachePersister.restoreClient();
  },
};
export const PERSIST_MAX_AGE = 14 * DAY_MS;

// Online means "has a network": the API may be on a LAN or VPS that answers even when
// Android's internet reachability check fails. The outbox retries until the server answers.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (status) => {
    handleFocus(status === "active");
  });
  return () => subscription.remove();
});
