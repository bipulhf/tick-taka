import { describe, expect, test } from "bun:test";
import {
  type FailureInfo,
  type OutboxRequest,
  type PersistedOutbox,
  STUCK_AFTER,
} from "../src/lib/outbox-policy";
import { type OutboxDeps, OutboxQueue } from "../src/lib/outbox-queue";

class HttpFailure extends Error {
  constructor(readonly info: FailureInfo) {
    super(info.status ? `HTTP ${info.status}` : "unreachable");
  }
}

/** A fake server: answers from a script, records what it received, and a fake disk. */
function harness(options: { saved?: unknown; online?: boolean } = {}) {
  const received: OutboxRequest[] = [];
  const answers: ((request: OutboxRequest) => unknown)[] = [];
  const state = { online: options.online ?? true, disk: options.saved as unknown };
  const rejected: OutboxRequest[] = [];
  const deps: OutboxDeps = {
    send: async (request) => {
      received.push(structuredClone(request));
      const answer = answers.shift();
      if (!answer) return { ok: true };
      const result = answer(request);
      if (result instanceof HttpFailure) throw result;
      return result;
    },
    describe: (error) => (error instanceof HttpFailure ? error.info : {}),
    canSend: () => state.online,
    load: async () => state.disk,
    save: async (saved: PersistedOutbox) => {
      state.disk = structuredClone(saved);
    },
    onRejected: (request) => rejected.push(request),
    delay: () => 1,
  };
  const queue = new OutboxQueue(deps);
  return { queue, received, answers, state, rejected };
}

const idle = async (queue: OutboxQueue) => {
  for (let i = 0; i < 50 && queue.size > 0; i++) await new Promise((r) => setTimeout(r, 2));
  await queue.flushed();
};

const post = (id: string): OutboxRequest => ({ method: "POST", path: "/tasks", body: { id } });

describe("outbox queue", () => {
  test("writes replay one at a time in the order they were made", async () => {
    const { queue, received } = harness();
    await queue.load();
    void queue.enqueue(post("a"));
    void queue.enqueue(post("b"));
    void queue.enqueue({ method: "PATCH", path: "/tasks/a", body: { title: "x" } });
    await idle(queue);
    expect(received.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /tasks",
      "POST /tasks",
      "PATCH /tasks/a",
    ]);
    expect((received[1]!.body as { id: string }).id).toBe("b");
  });

  test("nothing goes out offline; it all goes once the network is back", async () => {
    const { queue, received, state } = harness({ online: false });
    await queue.load();
    void queue.enqueue(post("a"));
    await new Promise((r) => setTimeout(r, 10));
    expect(received).toHaveLength(0);
    expect(queue.size).toBe(1);
    state.online = true;
    queue.kick();
    await idle(queue);
    expect(received).toHaveLength(1);
    expect(queue.size).toBe(0);
  });

  test("an unreachable server and 5xx keep the write until it lands", async () => {
    const { queue, received, answers } = harness();
    await queue.load();
    for (let i = 0; i < 6; i++) answers.push(() => new HttpFailure({ unreachable: true }));
    answers.push(() => new HttpFailure({ status: 502 }));
    answers.push(() => new HttpFailure({ status: 503 }));
    const done = queue.enqueue(post("a"));
    await expect(done).resolves.toEqual({ ok: true });
    expect(received).toHaveLength(9);
  });

  test("a final 4xx drops only that write and reports it", async () => {
    const { queue, received, answers, rejected } = harness();
    await queue.load();
    answers.push(() => new HttpFailure({ status: 400 }));
    const bad = queue.enqueue(post("bad"));
    const good = queue.enqueue(post("good"));
    await expect(bad).rejects.toThrow("HTTP 400");
    await expect(good).resolves.toEqual({ ok: true });
    expect(rejected.map((r) => (r.body as { id: string }).id)).toEqual(["bad"]);
    expect(received).toHaveLength(2);
  });

  test("a write that was sending when the app was killed is sent again after restart", async () => {
    const first = harness();
    await first.queue.load();
    first.answers.push(() => new Promise(() => {})); // never answers: the app dies mid-request
    void first.queue.enqueue(post("a"));
    void first.queue.enqueue(post("b"));
    await first.queue.flushed();
    await new Promise((r) => setTimeout(r, 5));

    const second = harness({ saved: first.state.disk });
    await second.queue.load();
    await idle(second.queue);
    expect(second.received.map((r) => (r.body as { id: string }).id)).toEqual(["a", "b"]);
    expect(second.state.disk).toMatchObject({ entries: [] });
  });

  test("after a restart the first write may have landed, so a repeat-stop 409 counts as done", async () => {
    const saved: PersistedOutbox = {
      version: 1,
      userId: "u1",
      entries: [
        {
          id: "s",
          request: { method: "POST", path: "/timer/stop", body: { endedAt: 5 } },
          queuedAt: 0,
          attempts: 0,
          maybeDelivered: false,
        },
      ],
    };
    const { queue, answers, rejected } = harness({ saved });
    answers.push(() => new HttpFailure({ status: 409 }));
    await queue.load();
    await idle(queue);
    expect(rejected).toHaveLength(0);
    expect(queue.size).toBe(0);
  });

  test("a 401 pauses the queue and keeps every write", async () => {
    const { queue, received, answers, state } = harness();
    await queue.load();
    answers.push(() => {
      state.online = false; // what marking the session expired does to canSend()
      return new HttpFailure({ status: 401 });
    });
    void queue.enqueue(post("a"));
    void queue.enqueue(post("b"));
    await new Promise((r) => setTimeout(r, 10));
    expect(queue.size).toBe(2);
    expect(state.disk).toMatchObject({ entries: [{}, {}] });

    // Same user signs back in.
    state.online = true;
    queue.kick();
    await idle(queue);
    expect(received.map((r) => (r.body as { id: string }).id)).toEqual(["a", "a", "b"]);
  });

  test("an edit queued behind its offline create is not lost to the create's server time", async () => {
    const { queue, received, answers } = harness();
    await queue.load();
    answers.push(() => ({ id: "t1", title: "Buy milk", updatedAt: 7_200_000 }));
    void queue.enqueue(post("t1"));
    void queue.enqueue({
      method: "PATCH",
      path: "/tasks/t1",
      body: { title: "Buy milk and eggs", updatedAt: 60_000 },
    });
    await idle(queue);
    expect(received[1]!.body).toEqual({ title: "Buy milk and eggs", updatedAt: 7_200_000 });
  });

  // QA-203: "bring old tasks into today", then a rename, both made offline.
  test("an edit queued behind a bulk move is not lost to the move's server time", async () => {
    const { queue, received, answers, state } = harness({ online: false });
    await queue.load();
    // The server's reply shape for /tasks/rescue-overdue, stamped at replay time.
    answers.push(() => ({
      moved: 1,
      before: [{ id: "t1", title: "Call bank" }],
      tasks: [{ id: "t1", title: "Call bank", updatedAt: 7_200_000 }],
    }));
    void queue.enqueue({
      method: "POST",
      path: "/tasks/rescue-overdue",
      body: { target: "today" },
    });
    void queue.enqueue({
      method: "PATCH",
      path: "/tasks/t1",
      body: { title: "Call bank about card", updatedAt: 60_000 },
    });
    state.online = true;
    queue.kick();
    await idle(queue);
    expect(received[1]!.body).toEqual({ title: "Call bank about card", updatedAt: 7_200_000 });
  });

  test("saved writes go before ones queued while loading, legacy writes before both", async () => {
    const saved: PersistedOutbox = {
      version: 1,
      userId: null,
      entries: [
        {
          id: "old",
          request: post("saved"),
          queuedAt: 0,
          attempts: 0,
          maybeDelivered: false,
        },
      ],
    };
    const { queue, received } = harness({ saved });
    void queue.enqueue(post("new"));
    await queue.load([post("legacy")]);
    await idle(queue);
    expect(received.map((r) => (r.body as { id: string }).id)).toEqual(["legacy", "saved", "new"]);
  });

  test("writes queued while the saved queue is still loading don't overwrite it", async () => {
    const saved: PersistedOutbox = {
      version: 1,
      userId: "u1",
      entries: [
        { id: "s", request: post("saved"), queuedAt: 0, attempts: 0, maybeDelivered: false },
      ],
    };
    const { queue, state } = harness({ online: false });
    let disk: unknown = saved;
    let release = () => {};
    const slowDisk = new Promise<void>((resolve) => {
      release = resolve;
    });
    const deps = (queue as unknown as { deps: OutboxDeps }).deps;
    deps.load = async () => {
      await slowDisk;
      return disk;
    };
    deps.save = async (next) => {
      disk = structuredClone(next);
    };
    const loading = queue.load();
    void queue.enqueue(post("new"));
    queue.setOwner("u1");
    await queue.flushed();
    expect(disk).toBe(saved);
    release();
    await loading;
    await queue.flushed();
    expect((disk as PersistedOutbox).entries.map((e) => e.request.body)).toEqual([
      { id: "saved" },
      { id: "new" },
    ]);
    expect(state.online).toBe(false);
  });

  test("a saved queue that can't be read yet is kept, and loads on the next try", async () => {
    const saved: PersistedOutbox = {
      version: 1,
      userId: "u1",
      entries: [
        { id: "s", request: post("saved"), queuedAt: 0, attempts: 0, maybeDelivered: false },
      ],
    };
    const { queue, state, received } = harness({ saved });
    const deps = (queue as unknown as { deps: OutboxDeps }).deps;
    let keyReadable = false;
    deps.load = async () => {
      if (!keyReadable) throw new Error("storage key can't be read");
      return state.disk;
    };
    await queue.load();
    expect(queue.savedUnreadable).toBe(true);
    void queue.enqueue(post("new"));
    await queue.flushed();
    await new Promise((r) => setTimeout(r, 5));
    // Nothing was sent ahead of the saved writes, and nothing was saved over them.
    expect(received).toHaveLength(0);
    expect(state.disk).toBe(saved);
    keyReadable = true;
    queue.kick(); // the app came forward: read again
    await idle(queue);
    expect(queue.savedUnreadable).toBe(false);
    expect(received.map((r) => (r.body as { id: string }).id)).toEqual(["saved", "new"]);
  });

  test("a write the server keeps failing on is set aside, and the ones behind it go", async () => {
    const { queue, received, answers, state } = harness();
    await queue.load();
    for (let i = 0; i < STUCK_AFTER; i++) answers.push(() => new HttpFailure({ status: 500 }));
    const poison = queue.enqueue({ method: "PATCH", path: "/events/e1", body: { endsOn: "x" } });
    poison.catch(() => {});
    void queue.enqueue(post("good"));
    await idle(queue);
    for (let i = 0; i < 50 && queue.sending > 0; i++) await new Promise((r) => setTimeout(r, 2));
    await queue.flushed();
    expect(received.map((r) => r.path)).toEqual([
      ...Array.from({ length: STUCK_AFTER }, () => "/events/e1"),
      "/tasks",
    ]);
    expect(queue.sending).toBe(0);
    expect(queue.size).toBe(1);
    expect(queue.stuck().map((e) => e.request.path)).toEqual(["/events/e1"]);
    await expect(poison).rejects.toBeInstanceOf(HttpFailure);
    expect((state.disk as PersistedOutbox).stuck?.map((e) => e.request.path)).toEqual([
      "/events/e1",
    ]);

    // Retry sends it again; this time it lands.
    queue.retryStuck(queue.stuck()[0]!.id);
    await idle(queue);
    expect(received.at(-1)?.path).toBe("/events/e1");
    expect(queue.size).toBe(0);
  });

  test("503, 429 and an unreachable server never make a write stuck", async () => {
    const { queue, answers } = harness();
    await queue.load();
    for (let i = 0; i < STUCK_AFTER; i++) {
      answers.push(() => new HttpFailure({ status: 503 }));
      answers.push(() => new HttpFailure({ unreachable: true }));
    }
    void queue.enqueue(post("a"));
    await idle(queue);
    expect(queue.stuck()).toHaveLength(0);
    expect(queue.size).toBe(0);
  });

  test("a stuck write can be discarded, and stays stuck across a restart until then", async () => {
    const saved: PersistedOutbox = {
      version: 1,
      userId: "u1",
      entries: [],
      stuck: [{ id: "s", request: post("bad"), queuedAt: 0, attempts: 8, maybeDelivered: true }],
    };
    const { queue, received, state } = harness({ saved });
    const discarded: OutboxRequest[] = [];
    (queue as unknown as { deps: OutboxDeps }).deps.onDiscarded = (r) => discarded.push(r);
    await queue.load();
    await idle(queue);
    expect(received).toHaveLength(0);
    expect(queue.stuck()).toHaveLength(1);
    queue.discardStuck("s");
    await queue.flushed();
    expect(queue.size).toBe(0);
    expect(discarded).toEqual([post("bad")]);
    expect((state.disk as PersistedOutbox).stuck).toEqual([]);
  });

  test("clearing empties the queue and the disk", async () => {
    const { queue, state } = harness({ online: false });
    await queue.load();
    queue.setOwner("u1");
    void queue.enqueue(post("a"));
    await queue.clear();
    expect(queue.size).toBe(0);
    expect(state.disk).toMatchObject({ entries: [], userId: null });
  });
});
