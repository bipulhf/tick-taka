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
