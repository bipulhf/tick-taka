import { describe, expect, test } from "bun:test";
import { safeToSpendLabel } from "../src/features/today/safe-to-spend-label";

const money = { leftTodayMinor: 33_700, spentTodayMinor: 35_000, dailyMinor: 68_700, daysLeft: 12 };

describe("safe-to-spend screen-reader label", () => {
  test("reads the amount, what was spent and the days left", () => {
    expect(safeToSpendLabel(money, { hidden: false })).toBe(
      "Safe to spend today, ৳337. ৳350 spent of ৳687. 12 days left.",
    );
  });

  test("says when today's amount is overspent, and adds the pace alert", () => {
    const label = safeToSpendLabel(
      { ...money, leftTodayMinor: -5_000, daysLeft: 1 },
      { hidden: false, paceAlert: "Food is running ahead of the month" },
    );
    expect(label).toBe(
      "Over today's amount by ৳50. ৳350 spent of ৳687. 1 day left. Food is running ahead of the month.",
    );
  });

  test("privacy mode hides every amount", () => {
    const label = safeToSpendLabel(money, { hidden: true });
    expect(label).not.toMatch(/৳|\d{3}/);
    expect(label).toContain("amount hidden");
  });
});
