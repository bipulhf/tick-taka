import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { focusManager, MutationCache, onlineManager, QueryClient } from "@tanstack/react-query";
import { AppState } from "react-native";
import { ApiError, type HttpMethod, send } from "./api";
import { notify } from "./notify";
import { type NewExpense, withNewExpense } from "./optimistic-spend";
import { keys, type TodayData } from "./queries";
import { updateToday } from "./today-cache";

export interface OutboxRequest {
  method: HttpMethod;
  path: string;
  body?: unknown;
  /** Shown if the server rejects the write. */
  label?: string;
}

const DAY_MS = 86_400_000;
let invalidateTimer: ReturnType<typeof setTimeout> | undefined;

/** After writes land, refresh everything once: one user, small data, always consistent. */
function scheduleRefresh() {
  clearTimeout(invalidateTimer);
  invalidateTimer = setTimeout(() => void queryClient.invalidateQueries(), 250);
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
  mutationCache: new MutationCache({
    onSuccess: scheduleRefresh,
    onError: (error, variables) => {
      const label = (variables as OutboxRequest | undefined)?.label;
      notify(`${label ? `${label}: ` : ""}${error.message}`);
      scheduleRefresh();
    },
  }),
});

/**
 * Offline writes: every change goes through one mutation key, scoped so queued
 * writes replay in order when the connection returns (even after a restart).
 */
queryClient.setMutationDefaults(["outbox"], {
  mutationFn: (request: OutboxRequest) => send(request.method, request.path, request.body),
  scope: { id: "outbox" },
  retry: (count, error) => !(error instanceof ApiError) && count < 3,
  onMutate: (request: OutboxRequest) => {
    const body = request.body as (NewExpense & { type?: string }) | undefined;
    if (request.method !== "POST" || request.path !== "/transactions" || body?.type !== "expense")
      return;
    const categories = queryClient.getQueryData<
      { id: string; parentId: string | null; budgetType: string }[]
    >(keys.categories);
    const timeZone =
      queryClient.getQueryData<{ timeZone: string }>(keys.settings)?.timeZone ?? "Asia/Dhaka";
    updateToday(queryClient, (data: TodayData) =>
      withNewExpense(data, body, categories ?? [], timeZone),
    );
  },
});

export const persister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "tt.query-cache",
  throttleTime: 1000,
});
export const PERSIST_MAX_AGE = 14 * DAY_MS;

// Online means "has a network": the API may be on a LAN or VPS that answers even when
// Android's internet reachability check fails. Failed requests retry on their own.
onlineManager.setEventListener((setOnline) =>
  NetInfo.addEventListener((state) => setOnline(state.isConnected !== false)),
);

focusManager.setEventListener((handleFocus) => {
  const subscription = AppState.addEventListener("change", (status) => {
    handleFocus(status === "active");
    // Safety net: replay any writes still queued from an offline spell.
    if (status === "active") void queryClient.resumePausedMutations();
  });
  return () => subscription.remove();
});
