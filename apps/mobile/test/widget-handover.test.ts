import { describe, expect, test } from "bun:test";
import { handOverWidgetWrites, withdrawLog } from "../src/features/widget/widget-pending";
import type { OutboxRequest, PersistedOutbox } from "../src/lib/outbox-policy";
import { type OutboxDeps, OutboxQueue } from "../src/lib/outbox-queue";

type Log = { id: string; amountMinor: number };

/** The widget's own offline lists, and a real outbox whose saved queue reads slowly. */
function setup(options: { keyReadable?: boolean } = {}) {
  const key = { readable: options.keyReadable ?? true };
  const server: string[] = [];
  let online = false;
  const widget = {
    logs: [
      { id: "w1", amountMinor: 2000 },
      { id: "w2", amountMinor: 6000 },
    ] as Log[],
    deletes: ["d1"],
  };
  const disk: { main: unknown; early: unknown } = { main: null, early: null };
  let release = () => {};
  const slow = new Promise<void>((resolve) => {
    release = resolve;
  });
  const deps: OutboxDeps = {
    send: async (request) => {
      const id = (request.body as { id?: string } | undefined)?.id;
      server.push(`${request.method} ${request.path}${id ? ` ${id}` : ""}`);
      return { ok: true };
    },
    describe: () => ({ unreachable: true }),
    canSend: () => online,
    load: async () => {
      await slow;
      if (!key.readable) throw new Error("storage key can't be read");
      return disk.main;
    },
    save: async (state: PersistedOutbox) => {
      disk.main = structuredClone(state);
    },
    loadEarly: async () => disk.early,
    saveEarly: async (state: PersistedOutbox) => {
      disk.early = structuredClone(state);
    },
  };
  const queue = new OutboxQueue(deps);
  const loaded = queue.load();
  const goOnline = () => {
    online = true;
  };
  const handOver = () =>
    handOverWidgetWrites({
      // After a failed read, the next start reads the saved queue again.
      ready: async () => {
        await loaded;
        await queue.load();
      },
      readLogs: async () => [...widget.logs],
      removeLogs: async (sent) => {
        widget.logs = widget.logs.filter((log) => !sent.includes(log));
      },
      readDeletes: async () => [...widget.deletes],
      removeDeletes: async (sent) => {
        widget.deletes = widget.deletes.filter((id) => !sent.includes(id));
      },
      send: (request: OutboxRequest) => {
        queue.enqueue(request).catch(() => {});
      },
      durable: () => queue.durable(),
    });
  return { widget, disk, queue, release, handOver, key, server, goOnline };
}

const paths = (state: unknown) =>
  (state as PersistedOutbox | null)?.entries.map((e) => `${e.request.method} ${e.request.path}`);

describe("handing the widget's offline taps to the outbox (QA-304, CQ-039)", () => {
  test("the widget keeps its copy until the outbox has saved both logs", async () => {
    const { widget, disk, release, handOver } = setup();
    const done = handOver();
    await new Promise((resolve) => setTimeout(resolve, 5));
    // The outbox hasn't loaded: nothing handed over yet, nothing trimmed.
    expect(widget.logs).toHaveLength(2);
    release();
    expect(await done).toBe(true);
    expect(paths(disk.main)).toEqual([
      "POST /transactions",
      "POST /transactions",
      "DELETE /transactions/d1",
    ]);
    expect((disk.main as PersistedOutbox).entries[0]?.request.body).toMatchObject({
      id: "w1",
      type: "expense",
    });
    expect(widget.logs).toEqual([]);
    expect(widget.deletes).toEqual([]);
  });

  test("while the outbox can't read its saved queue, the widget's copies stay", async () => {
    const { widget, disk, release, handOver } = setup({ keyReadable: false });
    release();
    expect(await handOver()).toBe(false);
    // Queued (and on the side key), but the widget's lists are the copy that's sure.
    expect(paths(disk.early)).toHaveLength(3);
    expect(widget.logs).toHaveLength(2);
    expect(widget.deletes).toEqual(["d1"]);
  });

  // QA-405: the outbox already holds the log (on its side key) when the widget's Undo runs.
  test("an Undo on the widget after a hand-over that couldn't finish still deletes the log", async () => {
    const { widget, queue, release, handOver, key, server, goOnline } = setup({
      keyReadable: false,
    });
    release();
    expect(await handOver()).toBe(false);

    // Undo of w1 on the widget, while it is still in the widget's waiting list.
    const withdrawn = withdrawLog(widget.logs, widget.deletes, "w1");
    expect(withdrawn).not.toBeNull();
    widget.logs = withdrawn?.logs ?? widget.logs;
    widget.deletes = withdrawn?.deletes ?? widget.deletes;

    // The key reads again; the app hands over and sends.
    key.readable = true;
    goOnline();
    expect(await handOver()).toBe(true);
    for (let i = 0; i < 50 && queue.size > 0; i++) await new Promise((r) => setTimeout(r, 2));
    // The POST went out from the side key, so a DELETE must follow it.
    expect(server.filter((line) => line === "POST /transactions w1")).toHaveLength(1);
    expect(server.filter((line) => line === "DELETE /transactions/w1")).toHaveLength(1);
    expect(server.indexOf("DELETE /transactions/w1")).toBeGreaterThan(
      server.indexOf("POST /transactions w1"),
    );
    expect(widget.logs).toEqual([]);
    expect(widget.deletes).toEqual([]);
  });
});

describe("withdrawing a widget log on Undo", () => {
  test("drops it from the waiting list and always queues its delete", () => {
    const logs = [{ id: "a" }, { id: "b" }];
    expect(withdrawLog(logs, ["x"], "a")).toEqual({ logs: [{ id: "b" }], deletes: ["x", "a"] });
    // Already queued for deletion: not twice.
    expect(withdrawLog(logs, ["a"], "a")?.deletes).toEqual(["a"]);
  });

  test("a log no longer waiting (sent by the widget or the app) isn't withdrawn here", () => {
    expect(withdrawLog([{ id: "b" }], [], "a")).toBeNull();
  });
});
