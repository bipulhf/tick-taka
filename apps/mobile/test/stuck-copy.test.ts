import { describe, expect, test } from "bun:test";
import type { OutboxEntry, OutboxRequest } from "../src/lib/outbox-policy";
import { describeDiscard, describeGroup, describeWrite } from "../src/lib/stuck-copy";

const A = "01J9Z8Y7X6W5V4T3S2R1Q0P9N8";
const T = "01J9Z8Y7X6W5V4T3S2R1Q0P9N7";
const entry = (request: OutboxRequest, id = request.path): OutboxEntry => ({
  id,
  request,
  queuedAt: 0,
  attempts: 0,
  maybeDelivered: false,
});

// QA-401 / UX-054: a stuck group reads as what it is, not as its failure label.
describe("stuck change copy", () => {
  test("a write is named by its kind, never by its failure label", () => {
    const cases: [OutboxRequest, string][] = [
      [{ method: "PATCH", path: `/accounts/${A}`, label: "Couldn't save" }, "Change to an account"],
      [{ method: "PUT", path: `/budgets/2026-10/${A}` }, "Change to a budget line"],
      [{ method: "POST", path: "/transactions", body: { type: "expense" } }, "New expense"],
      [{ method: "POST", path: "/time-entries", body: {} }, "New time entry"],
      [{ method: "DELETE", path: `/tasks/${T}` }, "Deleting a task"],
      [{ method: "POST", path: `/tasks/${T}/restore` }, "Restore of a task"],
      [{ method: "POST", path: `/recurring/${A}/pay`, body: { skip: false } }, "Payment of a bill"],
      [{ method: "POST", path: `/recurring/${A}/pay`, body: { skip: true } }, "Skip of a bill"],
      [{ method: "POST", path: `/recurring/${A}/unpay` }, "Undo of a bill payment"],
      [{ method: "POST", path: `/accounts/${A}/balance-check` }, "Balance check on an account"],
      [{ method: "POST", path: "/timer/stop" }, "Timer stop"],
    ];
    for (const [request, words] of cases) expect(describeWrite(request)).toBe(words);
  });

  test("the card says what waits with the stuck write, and Discard what it drops", () => {
    const group = [
      entry({ method: "POST", path: "/accounts", body: { id: A }, label: "Couldn't add" }),
      entry(
        { method: "POST", path: "/transactions", body: { type: "expense", accountId: A } },
        "e1",
      ),
      entry(
        { method: "POST", path: "/transactions", body: { type: "expense", accountId: A } },
        "e2",
      ),
      entry({ method: "PATCH", path: `/accounts/${A}` }),
    ];
    expect(describeGroup(group)).toBe("New account · 2 expenses, 1 account change waiting with it");
    expect(describeDiscard(group)).toBe(
      "Discarded: New account, with 2 expenses, 1 account change",
    );
    expect(describeGroup(group.slice(0, 1))).toBe("New account");
    expect(describeDiscard([entry({ method: "PATCH", path: `/categories/${A}` })])).toBe(
      "Discarded: Change to a category",
    );
  });
});
