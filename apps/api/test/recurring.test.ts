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

type PayResult = { transaction: Row | null; recurring: Row };

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
