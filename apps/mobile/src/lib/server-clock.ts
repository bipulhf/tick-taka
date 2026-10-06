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

/** Learns the offset from a response's server time, splitting the round trip evenly. */
export function noteServerTime(serverTime: number, sentAt: number, receivedAt: number): void {
  if (!Number.isFinite(serverTime)) return;
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
    if (!learned && Number.isFinite(saved)) {
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
