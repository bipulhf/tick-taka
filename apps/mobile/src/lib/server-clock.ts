import { EARLIEST_PLAUSIBLE_MS } from "@tick-taka/shared/dates";

/**
 * How far the server's clock is ahead of this phone's (ms). Edits are stamped in
 * server time, because the server keeps whichever edit is newest: a phone clock
 * running two minutes slow would otherwise lose every quick follow-up edit, like
 * an Undo. The offset is saved, so a cold start with no network still uses it.
 */
let offsetMs = 0;
/** A reply has taught the offset during this run; a saved one is then out of date. */
let learned = false;

export interface ClockStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

const KEY = "tt.server-clock";
let storage: ClockStorage | null = null;
let savedMs: number | null = null;

function save(): void {
  // Every reply re-measures the offset; only a real change is worth a write.
  if (!storage || (savedMs !== null && Math.abs(offsetMs - savedMs) < 1000)) return;
  savedMs = Math.round(offsetMs);
  storage.setItem(KEY, String(savedMs)).catch(() => {});
}

/** A server time worth learning from: a finite number no earlier than the app itself. */
function plausible(serverTime: number): boolean {
  return Number.isFinite(serverTime) && serverTime >= EARLIEST_PLAUSIBLE_MS;
}

/**
 * The server time a reply carries, or NaN when it carries none. Only our API sets the
 * header; a proxy's own error page (a 502 during a deploy, a 413) has none, and
 * `Number(null)` would read that as 0, the start of 1970.
 */
export function serverTimeOf(headers: { get(name: string): string | null }): number {
  const header = headers.get("x-server-time")?.trim();
  return header ? Number(header) : Number.NaN;
}

/**
 * Learns the offset from a response's server time, splitting the round trip evenly.
 * A missing or impossible time (NaN, 0, anything before the app existed) is ignored,
 * so a reply without the header can't stamp edits in 1970.
 */
export function noteServerTime(serverTime: number, sentAt: number, receivedAt: number): void {
  if (!plausible(serverTime)) return;
  offsetMs = serverTime - (sentAt + receivedAt) / 2;
  learned = true;
  save();
}

/** Restores the offset saved by an earlier run (call once at start-up) and keeps saving it. */
export async function restoreServerClock(store: ClockStorage): Promise<void> {
  storage = store;
  savedMs = null;
  try {
    const saved = Number((await store.getItem(KEY)) ?? Number.NaN);
    // An offset that puts "now" before the app existed was learned from a bad reply.
    if (!learned && Number.isFinite(saved) && plausible(Date.now() + saved)) {
      offsetMs = saved;
      savedMs = saved;
      return;
    }
  } catch {
    // Unreadable: the first reply teaches it again.
  }
  if (learned) save();
}

/** A moment measured on the phone's clock (a timer's end), in server time. */
export function toServerTime(phoneMs: number): number {
  return Math.round(phoneMs + offsetMs);
}

/** Now, in server time: use for every edit's `updatedAt` and tap time. */
export function editTime(): number {
  return toServerTime(Date.now());
}
