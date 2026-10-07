import { describe, expect, test } from "bun:test";
import { handOverWidgetWrites } from "../src/features/widget/widget-pending";
import type { OutboxRequest, PersistedOutbox } from "../src/lib/outbox-policy";
import { type OutboxDeps, OutboxQueue } from "../src/lib/outbox-queue";

type Log = { id: string; amountMinor: number };

/** The widget's own offline lists, and a real outbox whose saved queue reads slowly. */
function setup(options: { keyReadable?: boolean } = {}) {
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
    send: async () => ({ ok: true }),
    describe: () => ({ unreachable: true }),
    canSend: () => false,
    load: async () => {
      await slow;
      if (options.keyReadable === false) throw new Error("storage key can't be read");
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
  const handOver = () =>
    handOverWidgetWrites({
      ready: () => loaded,
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
  return { widget, disk, queue, release, handOver };
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
});
