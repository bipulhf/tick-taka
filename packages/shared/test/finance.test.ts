import { describe, expect, test } from "bun:test";
import {
  budgetAvailable,
  budgetPace,
  costInHours,
  debtPayoffForecast,
  effectiveHourlyRate,
  safeToSpendToday,
  suggestedMonthlySaving,
} from "../src/finance";

describe("finance", () => {
  test("safe to spend divides flexible left by days left including today", () => {
    // ৳17,920 left on 4 Oct (28 days left) → ৳640
    expect(safeToSpendToday(1_792_000, "2026-10-04")).toBe(64_000);
    expect(safeToSpendToday(-500, "2026-10-04")).toBe(0);
    expect(safeToSpendToday(10_050, "2026-10-31")).toBe(10_000);
  });

  test("pace alert", () => {
    expect(budgetPace(6_000, 10_000, "2026-10-15").status).toBe("ahead");
    expect(budgetPace(4_000, 10_000, "2026-10-15").status).toBe("on_track");
    expect(budgetPace(10_000, 10_000, "2026-10-15").status).toBe("over");
  });

  test("savings goal suggestion", () => {
    expect(suggestedMonthlySaving(1_200_000, 200_000, "2026-10-04", "2027-03-31")).toBe(166_700);
    expect(suggestedMonthlySaving(100, 200, "2026-10-04", "2027-03-31")).toBe(0);
    expect(suggestedMonthlySaving(100, 0, "2026-10-04", null)).toBeNull();
  });

  test("debt payoff forecast", () => {
    expect(debtPayoffForecast(1_000_000, 300_000, "2026-10")).toEqual({
      months: 4,
      clearedIn: "2027-01",
      lastPaymentMinor: 100_000,
    });
    expect(debtPayoffForecast(100, 0, "2026-10")).toBeNull();
  });

  test("hourly rate and cost in hours", () => {
    const rate = effectiveHourlyRate(4_500_000, 90 * 60); // ৳45,000 over 90h → ৳500/h
    expect(rate).toBe(50_000);
    expect(costInHours(325_000, rate)).toBe(6.5);
    expect(effectiveHourlyRate(100, 0)).toBeNull();
  });

  test("budget rollover", () => {
    expect(
      budgetAvailable({ limitMinor: 1000, spentMinor: 400, rollover: true, carriedMinor: 200 }),
    ).toBe(800);
    expect(
      budgetAvailable({ limitMinor: 1000, spentMinor: 400, rollover: false, carriedMinor: 200 }),
    ).toBe(600);
  });
});
