import type { Database } from "bun:sqlite";

interface Entry<T> {
  value: T;
  /** Requests (or jobs) using the handle right now; it is never closed while above zero. */
  leases: number;
  lastUsed: number;
}

export interface HandleCacheOptions {
  /** Most handles kept open; beyond this the least recently used idle ones are closed. */
  max: number;
  /** A handle nobody has used for this long is closed. */
  idleMs: number;
  /** Over `max`, only handles unused for at least this long are closed (a streamed reply may still read). */
  minIdleMs: number;
  now: () => number;
}

/**
 * Open SQLite handles for user databases, closed when idle or least recently
 * used, so file descriptors and page cache don't grow with every account.
 * In-memory databases (tests) are never closed: closing would lose them.
 */
export function createHandleCache<T extends { sqlite: Database }>(options: HandleCacheOptions) {
  // A Map keeps insertion order; re-inserting on use makes the first entry the least recent.
  const entries = new Map<string, Entry<T>>();

  const closeEntry = (key: string, entry: Entry<T>) => {
    entries.delete(key);
    entry.value.sqlite.close();
  };
  const closable = (entry: Entry<T>) =>
    entry.leases === 0 && entry.value.sqlite.filename !== ":memory:";

  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entry.lastUsed = options.now();
      entries.delete(key);
      entries.set(key, entry);
      return entry.value;
    },

    set(key: string, value: T): void {
      entries.set(key, { value, leases: 0, lastUsed: options.now() });
    },

    acquire(key: string): void {
      const entry = entries.get(key);
      if (entry) entry.leases++;
    },

    release(key: string): void {
      const entry = entries.get(key);
      if (!entry) return;
      entry.leases = Math.max(0, entry.leases - 1);
      entry.lastUsed = options.now();
    },

    /** Closes idle handles, then the least recently used ones while over `max`. */
    sweep(): void {
      const now = options.now();
      for (const [key, entry] of entries)
        if (closable(entry) && now - entry.lastUsed >= options.idleMs) closeEntry(key, entry);
      for (const [key, entry] of entries) {
        if (entries.size <= options.max) break;
        if (closable(entry) && now - entry.lastUsed >= options.minIdleMs) closeEntry(key, entry);
      }
    },

    /** Closes this handle if nobody holds it. */
    closeIfIdle(key: string): void {
      const entry = entries.get(key);
      if (entry && closable(entry)) closeEntry(key, entry);
    },

    /** Closes this handle now, leases or not (the account is being deleted). */
    close(key: string): void {
      const entry = entries.get(key);
      if (entry) closeEntry(key, entry);
    },

    get size(): number {
      return entries.size;
    },
  };
}
