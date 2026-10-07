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

export interface HandOverDeps<Log extends { id: string }> {
  /** Resolves once the outbox has tried to read its saved queue. */
  ready(): Promise<void>;
  readLogs(): Promise<Log[]>;
  removeLogs(sent: Log[]): Promise<void>;
  readDeletes(): Promise<string[]>;
  removeDeletes(sent: string[]): Promise<void>;
  send(request: OutboxRequest): void;
  /** Whether everything queued is safely in the outbox's own storage. */
  durable(): Promise<boolean>;
}

/**
 * Hands expenses logged (and undone) on the widget while offline to the outbox. The
 * widget's lists are the only durable copy until then, so they are trimmed only once
 * the outbox has loaded and saved without error. Otherwise they stay for the next
 * start; each log carries its own id, so one sent twice is saved once. Returns
 * whether the widget's copies were trimmed.
 */
export async function handOverWidgetWrites<Log extends { id: string }>(
  deps: HandOverDeps<Log>,
): Promise<boolean> {
  await deps.ready();
  const logs = await deps.readLogs();
  for (const log of logs)
    deps.send({ method: "POST", path: "/transactions", body: { ...log, type: "expense" } });
  // Quick-logs undone on the widget while it couldn't reach the server.
  const deletes = await deps.readDeletes();
  for (const id of deletes) deps.send({ method: "DELETE", path: `/transactions/${id}` });
  if (logs.length === 0 && deletes.length === 0) return true;
  if (!(await deps.durable())) return false;
  if (logs.length) await deps.removeLogs(logs);
  if (deletes.length) await deps.removeDeletes(deletes);
  return true;
}
