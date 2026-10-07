import { describe, expect, test } from "bun:test";
import {
  classifyFailure,
  followCreatedRecords,
  legacyOutboxRequests,
  type OutboxEntry,
  type OutboxRequest,
  parsePersistedOutbox,
  recordPath,
  retryDelay,
  tiedTo,
  tiesOf,
} from "../src/lib/outbox-policy";

const entry = (request: OutboxRequest, maybeDelivered = false): OutboxEntry => ({
  id: "e1",
  request,
  queuedAt: 0,
  attempts: 0,
  maybeDelivered,
});
const create = entry({ method: "POST", path: "/transactions", body: { id: "t1" } });

describe("outbox retry policy", () => {
  test("an unreachable server is retried, however many times it has failed", () => {
    const tired = { ...create, attempts: 500 };
    expect(classifyFailure(tired, { unreachable: true })).toBe("retry");
  });

  test("5xx, 408 and 429 wait and retry", () => {
    for (const status of [500, 502, 503, 504, 408, 429])
      expect(classifyFailure(create, { status })).toBe("retry");
  });

  test("validation and not-found errors are final", () => {
    for (const status of [400, 404, 409, 422])
      expect(classifyFailure(create, { status })).toBe("reject");
  });

  test("401 pauses for the session instead of dropping the write", () => {
    expect(classifyFailure(create, { status: 401 })).toBe("session");
  });

  test("an unknown failure with no status is final, so the queue can't spin on a bug", () => {
    expect(classifyFailure(create, {})).toBe("reject");
  });

  test("backoff doubles from one second and stops growing at a minute", () => {
    expect([1, 2, 3, 4].map(retryDelay)).toEqual([1000, 2000, 4000, 8000]);
    expect(retryDelay(7)).toBe(60_000);
    expect(retryDelay(40)).toBe(60_000);
  });
});

describe("repeats of writes that already landed", () => {
  test("restoring a live record or deleting a gone one is already done", () => {
    expect(
      classifyFailure(entry({ method: "POST", path: "/tasks/a/restore" }), { status: 409 }),
    ).toBe("applied");
    expect(classifyFailure(entry({ method: "DELETE", path: "/tasks/a" }), { status: 404 })).toBe(
      "applied",
    );
  });

  test("stop and checkout count as done only when an earlier attempt may have got through", () => {
    const stop = { method: "POST", path: "/timer/stop" } as const;
    const checkout = { method: "POST", path: "/shopping/checkout" } as const;
    expect(classifyFailure(entry(stop, true), { status: 409 })).toBe("applied");
    expect(classifyFailure(entry(checkout, true), { status: 400 })).toBe("applied");
    expect(classifyFailure(entry(stop, false), { status: 409 })).toBe("reject");
    expect(classifyFailure(entry(checkout, false), { status: 400 })).toBe("reject");
  });
});

describe("create, then edit, replayed later", () => {
  test("a queued edit moves up to the time the server stamped the new record", () => {
    const edit = entry({
      method: "PATCH",
      path: "/tasks/t1",
      body: { title: "Buy milk and eggs", updatedAt: 1_000 },
    });
    const other = entry({ method: "PATCH", path: "/tasks/t2", body: { updatedAt: 1_000 } });
    const changed = followCreatedRecords([edit, other], { id: "t1", updatedAt: 7_200_000 });
    expect(changed).toEqual([edit]);
    expect(edit.request.body).toEqual({ title: "Buy milk and eggs", updatedAt: 7_200_000 });
    expect(other.request.body).toEqual({ updatedAt: 1_000 });
  });

  test("records nested in the reply count too, and newer edits are left alone", () => {
    const edit = entry({ method: "PATCH", path: "/time-entries/s1", body: { updatedAt: 9_000 } });
    followCreatedRecords([edit], { started: { id: "s1", updatedAt: 5_000 }, stopped: null });
    expect(edit.request.body).toEqual({ updatedAt: 9_000 });
  });

  // QA-203: bulk moves answer with lists of rows, which must be followed too.
  test("rows listed in a bulk move's reply lift the edits queued after it", () => {
    const rename = entry({
      method: "PATCH",
      path: "/tasks/t1",
      body: { title: "Call bank about card", updatedAt: 1_000 },
    });
    const untouched = entry({ method: "PATCH", path: "/tasks/t9", body: { updatedAt: 1_000 } });
    followCreatedRecords([rename, untouched], {
      moved: 1,
      before: [{ id: "t1", title: "Call bank" }],
      tasks: [{ id: "t1", updatedAt: 7_200_000 }],
    });
    expect(rename.request.body).toEqual({ title: "Call bank about card", updatedAt: 7_200_000 });
    expect(untouched.request.body).toEqual({ updatedAt: 1_000 });

    const later = entry({ method: "PATCH", path: "/tasks/t2", body: { updatedAt: 1_000 } });
    followCreatedRecords([later], { moved: [{ id: "t2", updatedAt: 3_600_000 }], before: [] });
    expect(later.request.body).toEqual({ updatedAt: 3_600_000 });

    const listed = entry({ method: "PATCH", path: "/tasks/t3", body: { updatedAt: 1_000 } });
    followCreatedRecords([listed], [{ id: "t3", updatedAt: 5_000 }]);
    expect(listed.request.body).toEqual({ updatedAt: 5_000 });
  });
});

describe("saved queue", () => {
  test("bad entries are skipped and good ones kept", () => {
    const parsed = parsePersistedOutbox({
      version: 1,
      userId: "u1",
      entries: [
        {
          id: "a",
          request: { method: "POST", path: "/tasks" },
          queuedAt: 1,
          attempts: 0,
          maybeDelivered: false,
        },
        {
          id: "b",
          request: { method: "GET", path: "/tasks" },
          queuedAt: 1,
          attempts: 0,
          maybeDelivered: false,
        },
        "junk",
      ],
    });
    expect(parsed?.userId).toBe("u1");
    expect(parsed?.entries.map((e) => e.id)).toEqual(["a"]);
  });

  test("anything else is no queue at all", () => {
    expect(parsePersistedOutbox(null)).toBeNull();
    expect(parsePersistedOutbox({ version: 2, entries: [] })).toBeNull();
  });

  test("writes queued by the old TanStack outbox are picked up", () => {
    const cache = {
      clientState: {
        mutations: [
          {
            mutationKey: ["outbox"],
            state: {
              status: "pending",
              variables: { method: "POST", path: "/transactions", body: { id: "x" } },
            },
          },
          {
            mutationKey: ["outbox"],
            state: { status: "success", variables: { method: "POST", path: "/a" } },
          },
          {
            mutationKey: ["other"],
            state: { status: "pending", variables: { method: "POST", path: "/b" } },
          },
        ],
      },
    };
    expect(legacyOutboxRequests(cache)).toEqual([
      { method: "POST", path: "/transactions", body: { id: "x" } },
    ]);
    expect(legacyOutboxRequests(null)).toEqual([]);
  });
});

// QA-401 / CQ-043: what a stuck group holds back.
describe("tied to a stuck group", () => {
  const A = "01J9Z8Y7X6W5V4T3S2R1Q0P9N8";
  const C = "01J9Z8Y7X6W5V4T3S2R1Q0P9N7";
  const expense = (body: object): OutboxRequest => ({
    method: "POST",
    path: "/transactions",
    body: { id: "01J9Z8Y7X6W5V4T3S2R1Q0P9N6", type: "expense", ...body },
  });

  test("the record a write acts on is its path up to the last record id", () => {
    expect(recordPath({ method: "PATCH", path: `/accounts/${A}` })).toBe(`/accounts/${A}`);
    expect(recordPath({ method: "POST", path: `/accounts/${A}/balance-check` })).toBe(
      `/accounts/${A}`,
    );
    expect(recordPath({ method: "PUT", path: `/budgets/2026-10/${C}?x=1` })).toBe(
      `/budgets/2026-10/${C}`,
    );
    expect(recordPath({ method: "POST", path: "/transactions" })).toBeNull();
  });

  test("an edit, a balance check or a budget line holds back only writes to that record", () => {
    for (const stuck of [
      { method: "PATCH", path: `/accounts/${A}`, body: { name: "bKash" } },
      { method: "POST", path: `/accounts/${A}/balance-check`, body: { actualMinor: 1 } },
    ] as OutboxRequest[]) {
      const ties = tiesOf([stuck]);
      expect(tiedTo(expense({ accountId: A }), ties)).toBe(false);
      expect(tiedTo({ method: "DELETE", path: `/accounts/${A}` }, ties)).toBe(true);
      expect(tiedTo({ method: "POST", path: `/accounts/${A}/restore` }, ties)).toBe(true);
      // Another record whose path starts the same way isn't the same record.
      expect(tiedTo({ method: "PATCH", path: `/accounts/${A}X` }, ties)).toBe(false);
    }
    const budget = tiesOf([{ method: "PUT", path: `/budgets/2026-10/${C}`, body: {} }]);
    expect(tiedTo(expense({ categoryId: C }), budget)).toBe(false);
    expect(tiedTo({ method: "PATCH", path: `/categories/${C}` }, budget)).toBe(false);
  });

  test("a create holds back every write that names its record", () => {
    const ties = tiesOf([{ method: "POST", path: "/accounts", body: { id: A } }]);
    expect(tiedTo(expense({ accountId: A }), ties)).toBe(true);
    expect(tiedTo({ method: "PATCH", path: `/accounts/${A}` }, ties)).toBe(true);
    // Another create in the same collection is not tied to it.
    expect(tiedTo({ method: "POST", path: "/accounts", body: { id: C } }, ties)).toBe(false);
  });

  test("a stuck pay holds back its unpay and edits of the expense it logs", () => {
    const ties = tiesOf([
      { method: "POST", path: `/recurring/${A}/pay`, body: { transactionId: C, dueAt: 1 } },
    ]);
    expect(tiedTo({ method: "POST", path: `/recurring/${A}/unpay`, body: {} }, ties)).toBe(true);
    expect(tiedTo({ method: "PATCH", path: `/transactions/${C}` }, ties)).toBe(true);
  });
});
