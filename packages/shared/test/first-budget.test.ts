import { describe, expect, test } from "bun:test";
import { firstBudgetCategory, withFirstBudget } from "../src/first-budget";

const cat = (id: string, name: string, budgetType: string, extra: object = {}) => ({
  id,
  name,
  budgetType,
  kind: "expense",
  parentId: null,
  ...extra,
});

describe("firstBudgetCategory", () => {
  test("puts the whole amount on the catch-all Other", () => {
    const categories = [
      cat("food", "Food", "flexible"),
      cat("rent", "Rent", "fixed"),
      cat("other", "Other", "flexible"),
      cat("other-in", "Other income", "flexible", { kind: "income" }),
    ];
    expect(firstBudgetCategory(categories)).toBe("other");
  });

  test("falls back to the first top-level flexible expense category", () => {
    const categories = [
      cat("rent", "Rent", "fixed"),
      cat("eating", "Other", "flexible", { parentId: "food" }),
      cat("salary", "Salary", "flexible", { kind: "income" }),
      cat("transport", "Transport", "flexible"),
      cat("fun", "Fun", "flexible"),
    ];
    expect(firstBudgetCategory(categories)).toBe("transport");
  });

  test("is null without a flexible expense category", () => {
    expect(firstBudgetCategory([cat("rent", "Rent", "fixed")])).toBeNull();
    expect(firstBudgetCategory([])).toBeNull();
  });
});

describe("withFirstBudget", () => {
  // 4 Oct: 28 days left, including today.
  const empty = {
    dailyMinor: 0,
    spentTodayMinor: 0,
    leftTodayMinor: 0,
    flexibleLeftMinor: 0,
    daysLeft: 28,
    hasBudgets: false,
  };

  test("turns the month's amount into today's number", () => {
    expect(withFirstBudget(empty, 1_792_000, "2026-10-04")).toEqual({
      ...empty,
      dailyMinor: 64_000,
      leftTodayMinor: 64_000,
      flexibleLeftMinor: 1_792_000,
      hasBudgets: true,
    });
  });

  test("counts what was already spent this month and today", () => {
    // ৳1,000 spent before today, ৳250 today.
    const money = { ...empty, flexibleLeftMinor: -100_000, spentTodayMinor: 25_000 };
    const next = withFirstBudget(money, 1_892_000, "2026-10-04");
    expect(next.flexibleLeftMinor).toBe(1_792_000);
    expect(next.dailyMinor).toBe(64_000);
    expect(next.leftTodayMinor).toBe(39_000);
  });

  test("zero leaves the card asking", () => {
    expect(withFirstBudget(empty, 0, "2026-10-04").hasBudgets).toBe(false);
  });
});
