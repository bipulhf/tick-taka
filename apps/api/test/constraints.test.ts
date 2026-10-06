import { describe, expect, test } from "bun:test";
import { createTestContext, DEFAULT_NOW } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

describe("ranges checked against the stored row", () => {
  test("moving an event's end before its start is a 400, not a 500", async () => {
    const ctx = await createTestContext();
    const event = await ctx.request<Row>("POST", "/events", {
      name: "Trip",
      startsOn: "2026-10-10",
      endsOn: "2026-10-12",
    });
    expect(event.status).toBe(201);
    const early = await ctx.request("PATCH", `/events/${event.body.id}`, { endsOn: "2026-10-01" });
    expect(early.status).toBe(400);
    const late = await ctx.request("PATCH", `/events/${event.body.id}`, { startsOn: "2026-10-20" });
    expect(late.status).toBe(400);
    const fine = await ctx.request("PATCH", `/events/${event.body.id}`, { endsOn: "2026-10-15" });
    expect(fine.status).toBe(200);
  });
});

/** Writes the new CHECK constraints would refuse are turned away as 400s first. */
describe("amounts the database refuses are rejected up front", () => {
  test("editing an expense down to zero", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const expense = await ctx.request<Row>("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 5_000,
      occurredAt: DEFAULT_NOW,
    });
    const zero = await ctx.request("PATCH", `/transactions/${expense.body.id}`, {
      amountMinor: 0,
    });
    expect(zero.status).toBe(400);
    const adjustment = await ctx.request("PATCH", `/transactions/${expense.body.id}`, {
      type: "adjustment",
      amountMinor: -500,
    });
    expect(adjustment.status).toBe(200);
  });

  test("a foreign payment that converts to nothing", async () => {
    const ctx = await createTestContext();
    const { bkash } = await setupMoney(ctx);
    const salary = await ctx.request<Row>("POST", "/recurring", {
      kind: "income",
      name: "Tip jar",
      amountMinor: 1,
      currency: "USD",
      rrule: "FREQ=MONTHLY;BYMONTHDAY=1",
      nextDueAt: DEFAULT_NOW,
    });
    const res = await ctx.request("POST", `/recurring/${salary.body.id}/pay`, {
      accountId: bkash.id,
      rate: 0.001,
    });
    expect(res.status).toBe(400);
  });
});
