import { describe, expect, test } from "bun:test";
import { goalPace, goalTotals } from "../src/features/money/goal-money";

const goal = (savedMinor: number, deadline: string | null, extra = {}) => ({
  savedMinor,
  targetMinor: 1000,
  reached: savedMinor >= 1000,
  doneAt: null,
  deadline,
  suggestedMonthlyMinor: deadline ? 100 : null,
  ...extra,
});

describe("goal pace", () => {
  test("on track while saved keeps up with the line to the deadline, else behind", () => {
    // Half way from 1 Oct to 30 Nov (31 of 60 days).
    expect(goalPace(goal(600, "2026-11-30"), "2026-10-01", "2026-11-01")).toBe("on_track");
    expect(goalPace(goal(400, "2026-11-30"), "2026-10-01", "2026-11-01")).toBe("behind");
    expect(goalPace(goal(0, "2026-11-30"), "2026-11-01", "2026-11-01")).toBe("on_track");
  });
  test("done once reached or marked done; behind once the deadline passes; none without one", () => {
    expect(goalPace(goal(1000, "2026-11-30"), "2026-10-01", "2026-11-01")).toBe("done");
    expect(goalPace(goal(10, null, { doneAt: 1 }), "2026-10-01", "2026-11-01")).toBe("done");
    expect(goalPace(goal(900, "2026-10-31"), "2026-10-01", "2026-11-01")).toBe("behind");
    expect(goalPace(goal(0, null), "2026-10-01", "2026-11-01")).toBeNull();
  });
  test("totals: everything saved and targeted, the pace of open goals only", () => {
    expect(goalTotals([goal(300, "2026-12-01"), goal(1000, "2026-12-01"), goal(0, null)])).toEqual({
      savedMinor: 1300,
      targetMinor: 3000,
      monthlyMinor: 100,
    });
  });
});
