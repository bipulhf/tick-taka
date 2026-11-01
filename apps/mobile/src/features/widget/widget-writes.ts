import { newId } from "@tick-taka/shared/ids";
import * as SecureStore from "expo-secure-store";
import { apiUrl, request } from "@/lib/http";
import type { OutboxRequest } from "@/lib/outbox-policy";
import {
  type PendingWidgetRequest,
  readPendingDeletes,
  readPendingLogs,
  readPendingRequests,
  writePendingRequests,
} from "./widget-cache";
import { outcomeOf, withdrawRequests } from "./widget-pending";

async function authHeader() {
  return { authorization: `Bearer ${(await SecureStore.getItemAsync("tt.token")) ?? ""}` };
}

async function attempt(write: OutboxRequest): Promise<number | "unreachable"> {
  try {
    const response = await request(apiUrl(write.path), {
      method: write.method,
      headers: await authHeader(),
      ...(write.body === undefined ? {} : { json: write.body }),
    });
    return response.status;
  } catch {
    return "unreachable";
  }
}

async function anythingWaiting(): Promise<boolean> {
  const [requests, logs, deletes] = await Promise.all([
    readPendingRequests(),
    readPendingLogs(),
    readPendingDeletes(),
  ]);
  return requests.length + logs.length + deletes.length > 0;
}

export interface Delivery {
  /** The id each write was given, so Undo can find one still waiting. */
  ids: string[];
  queued: boolean;
  refused: boolean;
}

/**
 * Sends a tap's writes in order, or keeps them for the app to send when it can't.
 * While anything from an earlier tap still waits, these wait behind it: a later write
 * (an Undo) must never land before the one it reverses.
 */
export async function deliver(writes: OutboxRequest[]): Promise<Delivery> {
  const pending: PendingWidgetRequest[] = writes.map((write) => ({ id: newId(), request: write }));
  let waiting = await anythingWaiting();
  let refused = false;
  let queued = false;
  for (const [index, item] of pending.entries()) {
    if (!waiting) {
      const outcome = outcomeOf(item.request, await attempt(item.request));
      if (outcome === "sent") continue;
      if (outcome === "refused") {
        refused = true;
        break;
      }
      waiting = true;
    }
    await writePendingRequests([...(await readPendingRequests()), ...pending.slice(index)]);
    queued = true;
    break;
  }
  return { ids: pending.map((item) => item.id), queued, refused };
}

/**
 * Takes back a tap: writes still waiting on this phone leave the list (their reversal
 * queued behind, in case the app holds a copy); writes already sent are reversed.
 */
export async function takeBack(forward: string[], reverse: OutboxRequest[]): Promise<Delivery> {
  const reversal = reverse.map((write) => ({ id: newId(), request: write }));
  const withdrawn = withdrawRequests(await readPendingRequests(), forward, reversal);
  if (withdrawn) {
    await writePendingRequests(withdrawn);
    return { ids: reversal.map((item) => item.id), queued: true, refused: false };
  }
  return deliver(reverse);
}
