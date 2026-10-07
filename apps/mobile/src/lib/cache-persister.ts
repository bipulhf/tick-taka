import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";
import { KeyUnavailableError } from "./encrypted-storage";

/** How often a save checks whether the storage key reads again. */
const RETRY_MS = 5_000;

/**
 * Wraps the screen-cache persister so a storage key that can't be read at start never
 * costs the cache. TanStack deletes the stored cache whenever restoring throws; here
 * KeyUnavailableError restores nothing instead (the screens fetch) and keeps the stored
 * cache. Until it has been read, saves don't write over it. Once the key reads again,
 * the kept cache goes to `onLateRestore` first, and saving resumes after that.
 */
export function keepCacheOnKeyFailure(
  inner: Persister,
  onLateRestore: (client: PersistedClient) => void,
  now: () => number = Date.now,
): Persister {
  /** The stored cache couldn't be read yet, so it mustn't be saved over. */
  let owed = false;
  let lastTry = Number.NEGATIVE_INFINITY;

  const read = async (): Promise<PersistedClient | undefined | "locked"> => {
    try {
      return await inner.restoreClient();
    } catch (error) {
      if (error instanceof KeyUnavailableError) return "locked";
      throw error;
    }
  };

  return {
    async restoreClient() {
      const client = await read();
      owed = client === "locked";
      return client === "locked" ? undefined : client;
    },
    async persistClient(client) {
      if (owed) {
        if (now() - lastTry < RETRY_MS) return;
        lastTry = now();
        const kept = await read();
        if (kept === "locked") return;
        owed = false;
        if (kept) {
          // The next save, after the kept cache is merged in, writes both.
          onLateRestore(kept);
          return;
        }
      }
      await inner.persistClient(client);
    },
    async removeClient() {
      owed = false;
      await inner.removeClient();
    },
  };
}
