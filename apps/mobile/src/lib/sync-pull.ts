import { changedPathsFromCounts, syncChangesSchema } from "./sync-paths";

export interface ChangePullDeps {
  /** The signed-in user, when there is one and requests can go out now. */
  readyUser(): string | null;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
  };
  /** The outbox, as far as waiting for it to empty needs. */
  outbox: { readonly sending: number; subscribe(listener: () => void): () => void };
  /** GET /sync/changes?since=…&summary=true */
  fetchSummary(since: number): Promise<unknown>;
  refresh(path: string): void;
  /** Now, in server time (the cursor's clock). */
  now(): number;
  /** How long to wait for queued writes to land before giving up for now. */
  waitMs?: number;
}

const KEY = "tt.last-sync";

function outboxEmpty(outbox: ChangePullDeps["outbox"], timeoutMs: number): Promise<boolean> {
  if (outbox.sending === 0) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      stop();
      resolve(false);
    }, timeoutMs);
    const stop = outbox.subscribe(() => {
      if (outbox.sending > 0) return;
      clearTimeout(timer);
      stop();
      resolve(true);
    });
  });
}

/**
 * Asks the server what changed since the last look (GET /sync/changes): edits
 * made by the assistant, the widget or another device. Only the screens those
 * tables feed are refreshed, the same way a local write refreshes them. Waits for
 * queued writes to land first so a refetch doesn't hide them. One pull at a time.
 */
export function createChangePuller(deps: ChangePullDeps): () => Promise<void> {
  let running = false;
  return async () => {
    const userId = deps.readyUser();
    if (running || !userId) return;
    running = true;
    const key = `${KEY}.${userId}`;
    try {
      const stored = Number(await deps.storage.getItem(key));
      if (!stored) {
        // First run for this user: everything on screen was just fetched; start from now.
        await deps.storage.setItem(key, String(deps.now()));
        return;
      }
      // Queued writes land first, so a refetch doesn't hide them; try later if they don't.
      if (!(await outboxEmpty(deps.outbox, deps.waitMs ?? 30_000))) return;
      // Only which tables changed matters here, so ask for counts, not rows.
      const reply = syncChangesSchema.safeParse(await deps.fetchSummary(stored));
      if (!reply.success) return;
      for (const path of changedPathsFromCounts(reply.data.counts ?? {})) deps.refresh(path);
      await deps.storage.setItem(key, String(reply.data.serverTime));
    } catch (error) {
      // Offline or refused: the next reconnect or foreground tries again.
      console.warn("sync: couldn't pull changes", error);
    } finally {
      running = false;
    }
  };
}
