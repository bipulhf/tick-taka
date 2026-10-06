import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { createTestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";
const on = (month: number, day: number) => zonedTimeToUtc({ year: 2026, month, day, hour: 12 }, TZ);

describe("budget rollover", () => {
  test("budgets set once keep carrying unspent money through inherited months", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-09",
      budgets: [{ categoryId: fun.id, limitMinor: 300_000, rollover: true }],
    });
    const spend = (amountMinor: number, occurredAt: number) =>
      ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor,
        categoryId: fun.id,
        occurredAt,
      });
    await spend(100_000, on(9, 10));
    await spend(250_000, on(10, 3));
    const line = async (month: string) => {
      const res = await ctx.request<{ inherited: boolean; lines: Row[] }>(
        "GET",
        `/budgets?month=${month}`,
      );
      return {
        inherited: res.body.inherited,
        ...res.body.lines.find((l) => l.categoryId === fun.id),
      };
    };
    // October: 300k + 200k carried − 250k spent = 250k left.
    expect(await line("2026-10")).toMatchObject({
      inherited: true,
      carriedMinor: 200_000,
      availableMinor: 250_000,
    });
    // November carries October's leftover, December carries November's untouched total.
    expect(await line("2026-11")).toMatchObject({
      inherited: true,
      rollover: true,
      carriedMinor: 250_000,
      availableMinor: 550_000,
    });
    expect(await line("2026-12")).toMatchObject({ carriedMinor: 550_000 });
  });

  test("turning rollover off in a month stops the carry after it", async () => {
    const ctx = await createTestContext();
    const { category } = await setupMoney(ctx);
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-09",
      budgets: [{ categoryId: fun.id, limitMinor: 100_000, rollover: true }],
    });
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: fun.id, limitMinor: 100_000, rollover: false }],
    });
    await ctx.request("PUT", "/budgets", {
      month: "2026-11",
      budgets: [{ categoryId: fun.id, limitMinor: 100_000, rollover: true }],
    });
    const november = await ctx.request<{ lines: Row[] }>("GET", "/budgets?month=2026-11");
    expect(november.body.lines.find((l) => l.categoryId === fun.id)?.carriedMinor).toBe(0);
  });
});

describe("money totals count only the default currency", () => {
  test("a USD expense stays out of taka budgets, safe-to-spend and insights", async () => {
    const ctx = await createTestContext();
    const { cash, usd, category } = await setupMoney(ctx);
    const food = category("Food");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: food.id, limitMinor: 1_200_000 }],
    });
    const spend = (accountId: string, amountMinor: number) =>
      ctx.request("POST", "/transactions", {
        type: "expense",
        accountId,
        amountMinor,
        categoryId: food.id,
        occurredAt: on(10, 4),
      });
    await spend(cash.id, 12_000);
    await spend(usd.id, 5_000); // $50.00
    const safe = await ctx.request<Row>("GET", "/budgets/safe-to-spend");
    expect(safe.body.spentTodayMinor).toBe(12_000);
    const month = await ctx.request<{ lines: Row[]; foreignSpending: unknown[] }>(
      "GET",
      "/budgets?month=2026-10",
    );
    expect(month.body.lines.find((l) => l.categoryId === food.id)?.spentMinor).toBe(12_000);
    expect(month.body.foreignSpending).toEqual([{ currency: "USD", amountMinor: 5_000 }]);
    const summary = await ctx.request<{ totals: { spentMinor: number } }>(
      "GET",
      `/insights/summary?from=${on(10, 1)}&to=${on(10, 30)}`,
    );
    expect(summary.body.totals.spentMinor).toBe(12_000);
  });
});

// QA-302: one line of a month, without the rest of the month's lines.
describe("PUT /budgets/:month/:categoryId", () => {
  test("sets, keeps rollover when left out, and removes only its own line", async () => {
    const ctx = await createTestContext();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: true },
        { categoryId: fun.id, limitMinor: 200_000, rollover: false },
      ],
    });
    const put = (body: Record<string, unknown>) =>
      ctx.request<{ lines: Row[] }>("PUT", `/budgets/2026-10/${food.id}`, body);
    const set = await put({ limitMinor: 700_000 });
    expect(set.status).toBe(200);
    expect(set.body.lines.find((l) => l.categoryId === food.id)).toMatchObject({
      limitMinor: 700_000,
      rollover: true,
    });
    const removed = await put({ limitMinor: null });
    expect(removed.body.lines.find((l) => l.categoryId === food.id)?.hasBudget).toBe(false);
    expect(removed.body.lines.find((l) => l.categoryId === fun.id)).toMatchObject({
      hasBudget: true,
      limitMinor: 200_000,
    });
  });

  test("refuses a bad month, a negative limit and an unknown category", async () => {
    const ctx = await createTestContext();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const put = (path: string, limitMinor: number) =>
      ctx.request<{ error: { code: string } }>("PUT", path, { limitMinor });
    expect((await put(`/budgets/2026-13/${food.id}`, 1)).status).toBe(400);
    expect((await put(`/budgets/2026-10/${food.id}`, -1)).status).toBe(400);
    const unknown = await put("/budgets/2026-10/01K0000000000000000000000A", 1);
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.code).toBe("invalid_reference");
  });

  test("removing the only line of an inheriting month stops it inheriting that line", async () => {
    const ctx = await createTestContext();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    await ctx.request("PUT", "/budgets", {
      month: "2026-09",
      budgets: [{ categoryId: food.id, limitMinor: 500_000, rollover: false }],
    });
    const res = await ctx.request<{ inherited: boolean; lines: Row[] }>(
      "PUT",
      `/budgets/2026-10/${food.id}`,
      { limitMinor: null },
    );
    expect(res.body.inherited).toBe(false);
    expect(res.body.lines.find((l) => l.categoryId === food.id)?.hasBudget).toBe(false);
    const september = await ctx.request<{ lines: Row[] }>("GET", "/budgets?month=2026-09");
    expect(september.body.lines.find((l) => l.categoryId === food.id)?.limitMinor).toBe(500_000);
  });
});
