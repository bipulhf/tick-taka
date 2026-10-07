import { describe, expect, test } from "bun:test";
import type { OutboxRequest, PersistedOutbox } from "../src/lib/outbox-policy";
import { type OutboxDeps, OutboxQueue } from "../src/lib/outbox-queue";

/**
 * A phone's disk: the saved queue, and the side key for writes queued before the saved
 * queue could be read. `keyReadable: false` makes the saved queue unreadable, as when
 * the storage key can't be loaded.
 */
interface Disk {
  main: unknown;
  early: unknown;
  keyReadable: boolean;
  /** Reading the saved queue waits for this (a slow start). */
  slow?: Promise<void>;
  saveFails?: boolean;
}

function start(disk: Disk, online = true) {
  const received: OutboxRequest[] = [];
  const saveErrors: unknown[] = [];
  const deps: OutboxDeps = {
    send: async (request) => {
      received.push(structuredClone(request));
      return { ok: true };
    },
    describe: () => ({ unreachable: true }),
    canSend: () => online,
    load: async () => {
      await disk.slow;
      if (!disk.keyReadable) throw new Error("storage key can't be read");
      return disk.main;
    },
    save: async (state: PersistedOutbox) => {
      if (disk.saveFails) throw new Error("disk full");
      disk.main = structuredClone(state);
    },
    loadEarly: async () => disk.early,
    saveEarly: async (state: PersistedOutbox) => {
      if (disk.saveFails) throw new Error("disk full");
      disk.early = structuredClone(state);
    },
    onSaveFailed: (error) => saveErrors.push(error),
    delay: () => 1,
  };
  return { queue: new OutboxQueue(deps), received, saveErrors };
}

const post = (id: string): OutboxRequest => ({ method: "POST", path: "/tasks", body: { id } });
const ids = (requests: OutboxRequest[]) => requests.map((r) => (r.body as { id: string }).id);
const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const saved = (id: string): PersistedOutbox => ({
  version: 1,
  userId: "u1",
  entries: [{ id: "s", request: post(id), queuedAt: 0, attempts: 0, maybeDelivered: false }],
});

describe("writes queued before the saved queue is read (QA-304, CQ-039)", () => {
  test("are saved on their own at once, so a kill during start-up loses nothing", async () => {
    let release = () => {};
    const disk: Disk = {
      main: saved("old"),
      early: null,
      keyReadable: true,
      slow: new Promise<void>((resolve) => {
        release = resolve;
      }),
    };
    const first = start(disk, false);
    void first.queue.load();
    void first.queue.enqueue(post("new")).catch(() => {});
    await first.queue.flushed();
    expect(disk.main).toEqual(saved("old"));
    expect(ids((disk.early as PersistedOutbox).entries.map((e) => e.request))).toEqual(["new"]);

    // Killed before the saved queue was read. The next start sends both, oldest first.
    release();
    disk.slow = undefined;
    const second = start(disk);
    await second.queue.load();
    await settle();
    expect(ids(second.received)).toEqual(["old", "new"]);
    expect((disk.early as PersistedOutbox).entries).toEqual([]);
  });

  test("while the storage key can't be read they wait on disk, and go once it can", async () => {
    const disk: Disk = { main: saved("old"), early: null, keyReadable: false };
    const first = start(disk);
    await first.queue.load();
    expect(first.queue.savedUnreadable).toBe(true);
    void first.queue.enqueue(post("a")).catch(() => {});
    void first.queue.enqueue(post("b")).catch(() => {});
    await first.queue.flushed();
    expect(await first.queue.durable()).toBe(false);
    expect(first.received).toEqual([]);
    expect(disk.main).toEqual(saved("old"));

    // Next start, the key reads again.
    disk.keyReadable = true;
    const second = start(disk);
    await second.queue.load();
    await settle();
    expect(ids(second.received)).toEqual(["old", "a", "b"]);
    expect(await second.queue.durable()).toBe(true);
  });

  test("the same write saved both ways is sent once", async () => {
    const disk: Disk = { main: saved("old"), early: saved("old"), keyReadable: true };
    const { queue, received } = start(disk);
    await queue.load();
    await settle();
    expect(ids(received)).toEqual(["old"]);
  });
});

describe("a save that fails (CQ-039)", () => {
  test("is reported once, shows until a save works, and the queue isn't durable meanwhile", async () => {
    const disk: Disk = { main: null, early: null, keyReadable: true };
    const { queue, saveErrors } = start(disk, false);
    await queue.load();
    disk.saveFails = true;
    void queue.enqueue(post("a")).catch(() => {});
    void queue.enqueue(post("b")).catch(() => {});
    expect(await queue.durable()).toBe(false);
    expect(queue.notSaved).toBe(true);
    expect(saveErrors).toHaveLength(1);

    disk.saveFails = false;
    void queue.enqueue(post("c")).catch(() => {});
    expect(await queue.durable()).toBe(true);
    expect(queue.notSaved).toBe(false);
    expect(ids((disk.main as PersistedOutbox).entries.map((e) => e.request))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
