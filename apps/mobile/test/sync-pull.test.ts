import { describe, expect, test } from "bun:test";
import { type ChangePullDeps, createChangePuller } from "../src/lib/sync-pull";

/** A fake outbox whose number of writes still sending can be changed. */
function fakeOutbox(sending: number) {
  const listeners = new Set<() => void>();
  return {
    sending,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    land() {
      this.sending = 0;
      for (const listener of listeners) listener();
    },
  };
}

function setup(options: { cursor?: string; sending?: number; reply?: unknown } = {}) {
  const data = new Map<string, string>();
  if (options.cursor) data.set("tt.last-sync.u1", options.cursor);
  const asked: number[] = [];
  const refreshed: string[] = [];
  const outbox = fakeOutbox(options.sending ?? 0);
  const deps: ChangePullDeps = {
    readyUser: () => "u1",
    storage: {
      getItem: async (key) => data.get(key) ?? null,
      setItem: async (key, value) => {
        data.set(key, value);
      },
    },
    outbox,
    fetchSummary: async (since) => {
      asked.push(since);
      return options.reply ?? { serverTime: 9_000, changes: {}, counts: {} };
    },
    refresh: (path) => refreshed.push(path),
    now: () => 5_000,
    waitMs: 20,
  };
  return { pull: createChangePuller(deps), data, asked, refreshed, outbox };
}

describe("pulling changes made elsewhere (QA-309)", () => {
  test("the first pull for a user only starts the cursor at now", async () => {
    const { pull, data, asked } = setup();
    await pull();
    expect(data.get("tt.last-sync.u1")).toBe("5000");
    expect(asked).toEqual([]);
  });

  test("a summary refreshes only the mapped screens and moves the cursor to the server's time", async () => {
    const { pull, data, asked, refreshed } = setup({
      cursor: "1000",
      reply: { serverTime: 9_000, changes: {}, counts: { tasks: 2, habit_logs: 1, budgets: 0 } },
    });
    await pull();
    expect(asked).toEqual([1000]);
    expect(refreshed.sort()).toEqual(["/habits", "/tasks"]);
    expect(data.get("tt.last-sync.u1")).toBe("9000");
  });

  test("it waits for queued writes to land first", async () => {
    const { pull, asked, outbox } = setup({ cursor: "1000", sending: 2 });
    const pulling = pull();
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(asked).toEqual([]);
    outbox.land();
    await pulling;
    expect(asked).toEqual([1000]);
  });

  test("if they don't land in time it gives up and keeps the cursor", async () => {
    const { pull, data, asked } = setup({ cursor: "1000", sending: 1 });
    await pull();
    expect(asked).toEqual([]);
    expect(data.get("tt.last-sync.u1")).toBe("1000");
  });

  test("a reply that isn't a sync summary changes nothing", async () => {
    const { pull, data, refreshed } = setup({ cursor: "1000", reply: { ok: true } });
    await pull();
    expect(refreshed).toEqual([]);
    expect(data.get("tt.last-sync.u1")).toBe("1000");
  });
});
