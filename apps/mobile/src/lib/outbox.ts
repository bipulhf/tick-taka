import { onlineManager } from "@tanstack/react-query";
import { useMemo } from "react";
import { AppState } from "react-native";
import { ApiError, send } from "./api";
import { currentToken, ServerUnreachableError } from "./http";
import { notify } from "./notify";
import { type NewExpense, withNewExpense } from "./optimistic-spend";
import type { FailureInfo, OutboxRequest } from "./outbox-policy";
import { OutboxQueue } from "./outbox-queue";
import { keys, type TodayData } from "./queries";
import { queryClient, scheduleRefresh, takeLegacyOutbox } from "./query-client";
import { secureStorage } from "./secure-storage";
import { updateToday } from "./today-cache";
import { userTime } from "./user-time";

export type { OutboxRequest } from "./outbox-policy";

const STORAGE_KEY = "tt.outbox";

function describe(error: unknown): FailureInfo {
  if (error instanceof ServerUnreachableError) return { unreachable: true };
  if (error instanceof ApiError) {
    // Not our API's error shape: a captive portal or proxy answered, not the server.
    if (error.code === "http_error" && error.status !== 401) return { unreachable: true };
    return { status: error.status };
  }
  // A 200 that isn't JSON is a login page in front of the server, not a reply.
  if (error instanceof SyntaxError) return { unreachable: true };
  return {};
}

/** The one queue every write goes through; see OutboxQueue for the rules. */
export const outbox = new OutboxQueue({
  send: (request) => send(request.method, request.path, request.body),
  describe,
  canSend: () => onlineManager.isOnline() && Boolean(currentToken()),
  load: async () => {
    const raw = await secureStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  save: (state) => secureStorage.setItem(STORAGE_KEY, JSON.stringify(state)),
  onSent: (request) => scheduleRefresh(request.path),
  onRejected: (request, error) => {
    const message = error instanceof Error ? error.message : "The server refused the change";
    notify(`${request.label ? `${request.label}: ` : ""}${message}`);
    // Undo the optimistic change on screen.
    scheduleRefresh(request.path);
  },
});

let started: Promise<void> | null = null;

/** Loads the saved queue (and any writes an older build left in the query cache), then sends. */
export function startOutbox(): Promise<void> {
  started ??= (async () => {
    await outbox.load(await takeLegacyOutbox());
  })();
  return started;
}

onlineManager.subscribe((online) => {
  if (online) outbox.kick();
});
AppState.addEventListener("change", (status) => {
  if (status === "active") outbox.kick();
});

/** A just-logged expense comes off today's safe-to-spend at once, even offline. */
function applyOptimistic(request: OutboxRequest) {
  const body = request.body as (NewExpense & { type?: string }) | undefined;
  if (request.method !== "POST" || request.path !== "/transactions" || body?.type !== "expense")
    return;
  const categories = queryClient.getQueryData<
    { id: string; parentId: string | null; budgetType: string }[]
  >(keys.categories);
  const timeZone = userTime(queryClient.getQueryData<{ timeZone: string }>(keys.settings)).timeZone;
  updateToday(queryClient, (data: TodayData) =>
    withNewExpense(data, body, categories ?? [], timeZone),
  );
}

/** Queues a write; resolves with the server's reply once it lands. */
export function queueWrite(request: OutboxRequest): Promise<unknown> {
  applyOptimistic(request);
  return outbox.enqueue(request);
}

/**
 * Returns a function that queues a write. It runs now when online, or later in
 * order when offline. Pair with an optimistic cache update for instant screens.
 */
export function useOutbox() {
  return useMemo(
    () =>
      Object.assign(
        (request: OutboxRequest) => {
          // Refusals are reported by the queue itself.
          queueWrite(request).catch(() => {});
        },
        { async: queueWrite },
      ),
    [],
  );
}
