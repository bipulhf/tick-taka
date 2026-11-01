import type { OutboxRequest } from "@/lib/outbox-policy";

/**
 * What stays in the widget's offline list after the app handed some of it to the
 * outbox: everything it didn't send, including taps that landed on the widget while
 * the hand-over ran. Pure, so it can be tested.
 */
export function afterHandOver<T>(stored: T[], sent: T[], key: (item: T) => string): T[] {
  const gone = new Set(sent.map(key));
  return stored.filter((item) => !gone.has(key(item)));
}

/**
 * The widget's offline lists after Undo of a log still in its waiting list: the log
 * leaves the list, and its delete is queued as well. The app may already hold the log
 * (a hand-over that couldn't trim the list, with the outbox's storage unreadable), and
 * would send it later; the delete then follows it. If the server never got the log,
 * the delete answers 404, which the outbox counts as done. Null when the log isn't
 * waiting (it was sent): the caller deletes it on the server instead.
 */
export function withdrawLog<Log extends { id: string }>(
  logs: Log[],
  deletes: string[],
  id: string,
): { logs: Log[]; deletes: string[] } | null {
  if (!logs.some((log) => log.id === id)) return null;
  return {
    logs: logs.filter((log) => log.id !== id),
    deletes: deletes.includes(id) ? deletes : [...deletes, id],
  };
}

/**
 * The widget's waiting list after Undo of writes it still holds: they leave the list,
 * and the writes that reverse them join it, for the same reason as withdrawLog (the
 * app may already hold a copy, and the reversal then follows it). Null when none of
 * them is waiting (they were sent): the caller sends the reversal instead. Pure.
 */
export function withdrawRequests<Pending extends { id: string }>(
  pending: Pending[],
  forward: string[],
  reverse: Pending[],
): Pending[] | null {
  if (!pending.some((item) => forward.includes(item.id))) return null;
  return [...pending.filter((item) => !forward.includes(item.id)), ...reverse];
}

/**
 * What a widget write's answer means. sent: done (or already so: a 404 on a delete,
 * a 409 on a stop that already stopped). queue: try again from the app (offline, the
 * server is down, or the sign-in needs renewing). refused: the server said no for
 * good, so it isn't kept. Pure, so it can be tested.
 */
export function outcomeOf(
  request: OutboxRequest,
  status: number | "unreachable",
): "sent" | "queue" | "refused" {
  if (status === "unreachable" || status === 401 || status === 408 || status === 429)
    return "queue";
  if (status >= 500) return "queue";
  if (status < 300) return "sent";
  if (status === 404 && request.method === "DELETE") return "sent";
  if (status === 409 && request.path === "/timer/stop") return "sent";
  return "refused";
}

export interface HandOverDeps<Log extends { id: string }> {
  /** Resolves once the outbox has tried to read its saved queue. */
  ready(): Promise<void>;
  readLogs(): Promise<Log[]>;
  removeLogs(sent: Log[]): Promise<void>;
  readDeletes(): Promise<string[]>;
  removeDeletes(sent: string[]): Promise<void>;
  /** Every other widget write (quick-logs, ticks, habits, bills, focus), in tap order. */
  readRequests(): Promise<{ id: string; request: OutboxRequest }[]>;
  removeRequests(sent: { id: string; request: OutboxRequest }[]): Promise<void>;
  send(request: OutboxRequest): void;
  /** Whether everything queued is safely in the outbox's own storage. */
  durable(): Promise<boolean>;
}

/**
 * Hands writes tapped on the widgets while offline to the outbox. The widget's lists
 * are the only durable copy until then, so they are trimmed only once the outbox has
 * loaded and saved without error. Otherwise they stay for the next start; every write
 * carries its own id (or is a PUT, PATCH or pay that lands the same twice), so one
 * sent twice is saved once. Returns whether the widget's copies were trimmed.
 */
export async function handOverWidgetWrites<Log extends { id: string }>(
  deps: HandOverDeps<Log>,
): Promise<boolean> {
  await deps.ready();
  // Quick-logs from an older build, which kept them in lists of their own.
  const logs = await deps.readLogs();
  for (const log of logs)
    deps.send({ method: "POST", path: "/transactions", body: { ...log, type: "expense" } });
  const deletes = await deps.readDeletes();
  for (const id of deletes) deps.send({ method: "DELETE", path: `/transactions/${id}` });
  const requests = await deps.readRequests();
  for (const pending of requests) deps.send(pending.request);
  if (logs.length === 0 && deletes.length === 0 && requests.length === 0) return true;
  if (!(await deps.durable())) return false;
  if (logs.length) await deps.removeLogs(logs);
  if (deletes.length) await deps.removeDeletes(deletes);
  if (requests.length) await deps.removeRequests(requests);
  return true;
}
