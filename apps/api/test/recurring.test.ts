import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext, type TestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";
const due = (month: number) => zonedTimeToUtc({ year: 2026, month, day: 5, hour: 9 }, TZ);

async function internetBill(ctx: TestContext) {
  const { cash, category } = await setupMoney(ctx);
  const bill = await ctx.request<Row>("POST", "/recurring", {
    kind: "bill",
    name: "Internet",
    amountMinor: 120_000,
    accountId: cash.id,
    categoryId: category("Bills").id,
    rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
    nextDueAt: due(10),
  });
  return bill.body;
}

type PayResult = { transaction: Row | null; recurring: Row; previousDueAt: number | null };

describe("repeat rules that never occur are refused", () => {
  test("bills and tasks", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const bill = await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Internet",
      amountMinor: 120_000,
      accountId: cash.id,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=0",
      nextDueAt: due(10),
    });
    expect(bill.status).toBe(400);
    const task = await ctx.request("POST", "/tasks", {
      title: "Water plants",
      rrule: "FREQ=YEARLY;BYMONTH=13",
    });
    expect(task.status).toBe(400);
  });
});

describe("paying a bill is safe to replay", () => {
  test("the same transactionId twice logs one expense and advances once", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const body = { transactionId: newId() };
    const first = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, body);
    expect(first.body.recurring.nextDueAt).toBe(due(11));
    const replay = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, body);
    expect(replay.status).toBe(200);
    expect(replay.body.recurring.nextDueAt).toBe(due(11));
    expect(replay.body.transaction?.id).toBe(body.transactionId);
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(1);
  });

  test("a pay or skip for an occurrence already handled changes nothing", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const skip = { skip: true, transactionId: newId(), dueAt: due(10) };
    const first = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, skip);
    expect(first.body.recurring.nextDueAt).toBe(due(11));
    const replay = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, skip);
    expect(replay.status).toBe(200);
    expect(replay.body.recurring.nextDueAt).toBe(due(11));
    // A double tap on "Paid" for October, each tap with a fresh id.
    const late = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, {
      transactionId: newId(),
      dueAt: due(10),
    });
    expect(late.body.transaction).toBeNull();
    expect(late.body.recurring.nextDueAt).toBe(due(11));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(0);
    // November is still payable.
    const november = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, {
      transactionId: newId(),
      dueAt: due(11),
    });
    expect(november.body.transaction).not.toBeNull();
    expect(november.body.recurring.nextDueAt).toBe(due(12));
  });
});

describe("paying a bill can be undone", () => {
  test("the reply names the due date it moved from; delete + move back restores the bill", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const transactionId = newId();
    const paid = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, {
      transactionId,
      dueAt: due(10),
    });
    expect(paid.body.previousDueAt).toBe(due(10));

    expect((await ctx.request("DELETE", `/transactions/${transactionId}`)).status).toBe(200);
    const restored = await ctx.request<Row>("PATCH", `/recurring/${bill.id}`, {
      nextDueAt: paid.body.previousDueAt,
    });
    expect(restored.body.nextDueAt).toBe(due(10));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(0);
  });

  // QA-303: the first reply was lost, so the phone only saw the replay's.
  test("a replayed pay still names the due date the logged pay moved from", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const body = { transactionId: newId(), dueAt: due(10) };
    await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, body);
    const replay = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, body);
    expect(replay.body.transaction?.id).toBe(body.transactionId);
    expect(replay.body.previousDueAt).toBe(due(10));

    await ctx.request("DELETE", `/transactions/${body.transactionId}`);
    const restored = await ctx.request<Row>("PATCH", `/recurring/${bill.id}`, {
      nextDueAt: replay.body.previousDueAt,
    });
    expect(restored.body.nextDueAt).toBe(due(10));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(0);
  });

  test("a replay after the bill moved on again names nothing to move back to", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const october = { transactionId: newId(), dueAt: due(10) };
    await ctx.request("POST", `/recurring/${bill.id}/pay`, october);
    await ctx.request("POST", `/recurring/${bill.id}/pay`, {
      transactionId: newId(),
      dueAt: due(11),
    });
    const replay = await ctx.request<PayResult>("POST", `/recurring/${bill.id}/pay`, october);
    expect(replay.body.previousDueAt).toBeNull();
    expect(replay.body.recurring.nextDueAt).toBe(due(12));
  });
});

type UnpayResult = { transaction: Row | null; recurring: Row; movedBack: boolean };

describe("taking back a pay in one write (unpay)", () => {
  test("deletes the logged expense and moves the due date back, whatever the pay replied", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const pay = { transactionId: newId(), dueAt: due(10) };
    await ctx.request("POST", `/recurring/${bill.id}/pay`, pay);
    await ctx.request("POST", `/recurring/${bill.id}/pay`, pay); // a replay
    const undone = await ctx.request<UnpayResult>("POST", `/recurring/${bill.id}/unpay`, pay);
    expect(undone.status).toBe(200);
    expect(undone.body.movedBack).toBe(true);
    expect(undone.body.recurring.nextDueAt).toBe(due(10));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(0);

    // Sent again by the outbox: nothing more changes.
    const again = await ctx.request<UnpayResult>("POST", `/recurring/${bill.id}/unpay`, pay);
    expect(again.status).toBe(200);
    expect(again.body.movedBack).toBe(false);
    expect(again.body.recurring.nextDueAt).toBe(due(10));
  });

  test("a pay that logged nothing (refused, or already done) moves nothing back", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    await ctx.request("POST", `/recurring/${bill.id}/pay`, {
      transactionId: newId(),
      dueAt: due(10),
    });
    // A second "Paid" for October from another tap: it logged nothing.
    const late = { transactionId: newId(), dueAt: due(10) };
    await ctx.request("POST", `/recurring/${bill.id}/pay`, late);
    const undone = await ctx.request<UnpayResult>("POST", `/recurring/${bill.id}/unpay`, late);
    expect(undone.body.movedBack).toBe(false);
    expect(undone.body.recurring.nextDueAt).toBe(due(11));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(1);
  });

  test("a skip is taken back by moving the due date back", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const skip = { transactionId: newId(), dueAt: due(10), skip: true };
    await ctx.request("POST", `/recurring/${bill.id}/pay`, skip);
    const undone = await ctx.request<UnpayResult>("POST", `/recurring/${bill.id}/unpay`, skip);
    expect(undone.body.movedBack).toBe(true);
    expect(undone.body.recurring.nextDueAt).toBe(due(10));
  });

  test("October's undo after November was paid keeps November's date", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const october = { transactionId: newId(), dueAt: due(10) };
    await ctx.request("POST", `/recurring/${bill.id}/pay`, october);
    await ctx.request("POST", `/recurring/${bill.id}/pay`, {
      transactionId: newId(),
      dueAt: due(11),
    });
    const undone = await ctx.request<UnpayResult>("POST", `/recurring/${bill.id}/unpay`, october);
    expect(undone.body.movedBack).toBe(false);
    expect(undone.body.recurring.nextDueAt).toBe(due(12));
    const expenses = await ctx.request<{ items: Row[] }>("GET", "/transactions?type=expense");
    expect(expenses.body.items).toHaveLength(1);
  });

  test("another bill's transaction id is refused", async () => {
    const ctx = await createTestContext();
    const bill = await internetBill(ctx);
    const rent = await ctx.request<Row>("POST", "/recurring", {
      kind: "bill",
      name: "Rent",
      amountMinor: 1_000_000,
      accountId: bill.accountId,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
      nextDueAt: due(10),
    });
    const pay = { transactionId: newId(), dueAt: due(10) };
    await ctx.request("POST", `/recurring/${rent.body.id}/pay`, pay);
    const undone = await ctx.request("POST", `/recurring/${bill.id}/unpay`, pay);
    expect(undone.status).toBe(409);
  });
});
