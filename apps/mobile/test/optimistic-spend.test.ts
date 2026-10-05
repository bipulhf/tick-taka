import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { withNewExpense } from "../src/lib/optimistic-spend";
import type { TodayData } from "../src/lib/queries";

const TZ = "Asia/Dhaka";
const today = (hasBudgets = true) =>
  ({
    date: "2026-10-05",
    safeToSpend: {
      hasBudgets,
      dailyMinor: 71_500,
      spentTodayMinor: 31_000,
      leftTodayMinor: 40_500,
    },
  }) as unknown as TodayData;
const categories = [
  { id: "food", parentId: null, budgetType: "flexible" },
  { id: "groceries", parentId: "food", budgetType: "flexible" },
  { id: "rent", parentId: null, budgetType: "fixed" },
];
const now = zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 20 }, TZ);

describe("instant safe-to-spend", () => {
  test("a flexible expense today comes off at once", () => {
    const next = withNewExpense(
      today(),
      { amountMinor: 48_000, categoryId: "groceries", occurredAt: now },
      categories,
      TZ,
    );
    expect(next.safeToSpend).toMatchObject({ spentTodayMinor: 79_000, leftTodayMinor: -7_500 });
  });

  test("uncategorised spending counts too", () => {
    const next = withNewExpense(
      today(),
      { amountMinor: 1_000, categoryId: null, occurredAt: now },
      categories,
      TZ,
    );
    expect(next.safeToSpend.leftTodayMinor).toBe(39_500);
  });

  test("fixed costs, other days and no budgets leave it alone", () => {
    const rent = withNewExpense(
      today(),
      { amountMinor: 1_000, categoryId: "rent", occurredAt: now },
      categories,
      TZ,
    );
    const yesterday = withNewExpense(
      today(),
      { amountMinor: 1_000, categoryId: "food", occurredAt: now - 86_400_000 },
      categories,
      TZ,
    );
    const noBudgets = withNewExpense(
      today(false),
      { amountMinor: 1_000, occurredAt: now },
      categories,
      TZ,
    );
    expect(rent.safeToSpend.leftTodayMinor).toBe(40_500);
    expect(yesterday.safeToSpend.leftTodayMinor).toBe(40_500);
    expect(noBudgets.safeToSpend.leftTodayMinor).toBe(40_500);
  });
});
