import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { payRecurring, unpayRequest } from "../src/features/money/recurring-pay";
import type { OutboxRequest, PersistedOutbox } from "../src/lib/outbox-policy";
import { type OutboxDeps, OutboxQueue } from "../src/lib/outbox-queue";

/** A real outbox over a fake disk and a fake server that can be switched on and off. */
function phone(options: { disk?: unknown; online?: boolean; hang?: boolean } = {}) {
  const received: OutboxRequest[] = [];
  const state = { online: options.online ?? true, disk: options.disk };
  const deps: OutboxDeps = {
    send: async (request) => {
      received.push(structuredClone(request));
      // The reply never comes: the app is killed while the pay is on its way.
      if (options.hang) return new Promise(() => {});
      return { ok: true };
    },
    describe: () => ({ unreachable: true }),
    canSend: () => state.online,
    load: async () => state.disk,
    save: async (saved: PersistedOutbox) => {
      state.disk = structuredClone(saved);
    },
    delay: () => 1,
  };
  const queue = new OutboxQueue(deps);
  const send = Object.assign(
    (request: OutboxRequest) => {
      queue.enqueue(request).catch(() => {});
    },
    { cancel: (match: (request: OutboxRequest) => boolean) => queue.cancel(match) },
  );
  return { queue, send, received, state };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
const rent = { id: newId(), name: "Rent" };

describe("undoing a bill pay (UX-042)", () => {
  test("the reversal is one write that names the pay's own transaction and due date", () => {
    const body = { transactionId: "t1", dueAt: 100, skip: false, accountId: "a1" };
    expect(unpayRequest(rent, body)).toEqual({
      method: "POST",
      path: `/recurring/${rent.id}/unpay`,
      body: { transactionId: "t1", dueAt: 100, skip: false },
      label: "Couldn't undo Rent",
    });
  });

  test("offline, Undo takes the pay out of the saved queue, so a restart sends nothing", async () => {
    const first = phone({ online: false });
    await first.queue.load();
    const undo = payRecurring(first.send, rent, { transactionId: newId(), dueAt: 100 });
    await first.queue.flushed();
    expect((first.state.disk as PersistedOutbox).entries).toHaveLength(1);
    undo();
    await first.queue.flushed();
    expect((first.state.disk as PersistedOutbox).entries).toEqual([]);

    // The app is killed before the phone reconnects; on the next start it is online.
    const second = phone({ disk: first.state.disk });
    await second.queue.load();
    await settle();
    expect(second.received).toEqual([]);
  });

  test("once the pay may have gone out, Undo saves its reversal behind it", async () => {
    const first = phone({ hang: true });
    await first.queue.load();
    const transactionId = newId();
    const undo = payRecurring(first.send, rent, { transactionId, dueAt: 100 });
    await settle(); // the pay is on its way
    undo();
    await first.queue.flushed();
    expect(
      (first.state.disk as PersistedOutbox).entries.map(
        (e) => `${e.request.method} ${e.request.path}`,
      ),
    ).toEqual([`POST /recurring/${rent.id}/pay`, `POST /recurring/${rent.id}/unpay`]);

    // Killed before the reply: the next start sends the pay again, then its Undo.
    const second = phone({ disk: first.state.disk });
    await second.queue.load();
    await settle();
    expect(second.received.map((r) => r.path)).toEqual([
      `/recurring/${rent.id}/pay`,
      `/recurring/${rent.id}/unpay`,
    ]);
    expect(second.received[1]?.body).toEqual({ transactionId, dueAt: 100, skip: false });
  });

  test("after the pay landed, Undo still goes through the saved queue", async () => {
    const { queue, send, received, state } = phone();
    await queue.load();
    const undo = payRecurring(send, rent, { transactionId: newId(), dueAt: 100, skip: true });
    await settle();
    expect(received).toHaveLength(1);
    state.online = false;
    undo();
    await queue.flushed();
    expect((state.disk as PersistedOutbox).entries.map((e) => e.request.path)).toEqual([
      `/recurring/${rent.id}/unpay`,
    ]);
  });
});
