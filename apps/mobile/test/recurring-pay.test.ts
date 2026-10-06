import { describe, expect, test } from "bun:test";
import { payRecurring, undoPayRequests } from "../src/features/money/recurring-pay";
import type { OutboxRequest } from "../src/lib/outbox-policy";

describe("undoing a bill pay", () => {
  test("deletes the transaction, then moves the due date back", () => {
    expect(
      undoPayRequests("r1", "Rent", { transaction: { id: "t1" }, previousDueAt: 100 }),
    ).toEqual([
      { method: "DELETE", path: "/transactions/t1", label: "Couldn't undo Rent" },
      {
        method: "PATCH",
        path: "/recurring/r1",
        body: { nextDueAt: 100 },
        label: "Couldn't undo Rent",
      },
    ]);
  });

  test("a skip only moves the date back; a replayed pay only deletes", () => {
    expect(undoPayRequests("r1", "Rent", { transaction: null, previousDueAt: 100 })).toHaveLength(
      1,
    );
    expect(
      undoPayRequests("r1", "Rent", { transaction: { id: "t1" }, previousDueAt: null }),
    ).toEqual([{ method: "DELETE", path: "/transactions/t1", label: "Couldn't undo Rent" }]);
  });

  test("Undo waits for the pay to land and sends nothing if it was refused", async () => {
    const sent: OutboxRequest[] = [];
    let land: (reply: unknown) => void = () => {};
    const send = Object.assign((request: OutboxRequest) => void sent.push(request), {
      async: (request: OutboxRequest) => {
        sent.push(request);
        return new Promise<unknown>((resolve) => {
          land = resolve;
        });
      },
    });
    const undo = payRecurring(send, { id: "r1", name: "Rent" }, { transactionId: "t1" });
    undo();
    expect(sent.map((r) => r.method)).toEqual(["POST"]);
    land({ transaction: { id: "t1" }, previousDueAt: 100 });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(sent.map((r) => `${r.method} ${r.path}`)).toEqual([
      "POST /recurring/r1/pay",
      "DELETE /transactions/t1",
      "PATCH /recurring/r1",
    ]);

    const refused: OutboxRequest[] = [];
    const failing = Object.assign((request: OutboxRequest) => void refused.push(request), {
      async: () => Promise.reject(new Error("400")),
    });
    payRecurring(failing, { id: "r1", name: "Rent" }, {})();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(refused).toEqual([]);
  });
});
