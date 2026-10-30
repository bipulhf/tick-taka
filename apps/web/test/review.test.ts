import { describe, expect, test } from "bun:test";
import { localParts, startOfLocalDay } from "@tick-taka/shared/dates";
import { cents, costByDay, dollars, thousands } from "../src/features/review/ai-usage-format";
import { compactNumber, fraction, niceDomain, niceStep } from "../src/features/review/charts/scale";
import { stepIndex } from "../src/features/review/charts/use-width";
import { planShare, streakText, winLines } from "../src/features/review/gentle-progress";
import {
  areaStats,
  dayTick,
  reportSpan,
  rollUpByParent,
  spendingByDay,
} from "../src/features/review/insights-data";
import { budgetLines, jarMoves, leftToAssign, prefill } from "../src/features/review/payday-math";
import { withTopPicked, withTopUnpicked } from "../src/features/review/shutdown-cache";
import {
  carriedTo,
  freshProgress,
  readProgress,
  saveProgress,
} from "../src/features/review/shutdown-progress";

const ZONE = "Asia/Dhaka";

describe("chart scale", () => {
  test("steps are clean numbers", () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1.8)).toBe(2);
    expect(niceStep(2.3)).toBe(2.5);
    expect(niceStep(380)).toBe(500);
    expect(niceStep(7000)).toBe(10_000);
  });

  test("a domain from zero covers the largest value with about three ticks", () => {
    const domain = niceDomain(0, 2660, 3);
    expect(domain.min).toBe(0);
    expect(domain.max).toBeGreaterThanOrEqual(2660);
    expect(domain.ticks[0]).toBe(0);
    expect(domain.ticks.at(-1)).toBe(domain.max);
    expect(domain.ticks.length).toBeLessThanOrEqual(5);
  });

  test("an empty or flat series still draws", () => {
    expect(niceDomain(0, 0)).toEqual({ min: 0, max: 1, ticks: [0, 1] });
    const flat = niceDomain(500, 500);
    expect(flat.min).toBe(0);
    expect(flat.max).toBeGreaterThanOrEqual(500);
  });

  test("compact labels", () => {
    expect(compactNumber(126_010)).toBe("126k");
    expect(compactNumber(2500)).toBe("2.5k");
    expect(compactNumber(1_200_000)).toBe("1.2M");
    expect(compactNumber(40)).toBe("40");
    expect(compactNumber(-3000)).toBe("−3k");
  });

  test("fraction clamps", () => {
    expect(fraction(5, 0, 10)).toBe(0.5);
    expect(fraction(20, 0, 10)).toBe(1);
    expect(fraction(3, 3, 3)).toBe(0);
  });

  test("arrow keys walk the marks, starting at the latest", () => {
    expect(stepIndex("ArrowLeft", null, 5)).toBe(4);
    expect(stepIndex("ArrowLeft", 0, 5)).toBe(0);
    expect(stepIndex("ArrowRight", 2, 5)).toBe(3);
    expect(stepIndex("Home", 3, 5)).toBe(0);
    expect(stepIndex("x", 3, 5)).toBeNull();
    expect(stepIndex("ArrowRight", null, 0)).toBeNull();
  });
});

describe("reports", () => {
  test("periods", () => {
    const thisMonth = reportSpan("this", "2026-10", ZONE);
    expect(thisMonth.from).toBe(startOfLocalDay("2026-10-01", ZONE));
    expect(reportSpan("last", "2026-10", ZONE).to).toBe(thisMonth.from);
    expect(reportSpan("quarter", "2026-10", ZONE).from).toBe(startOfLocalDay("2026-08-01", ZONE));
  });

  test("child categories roll into their parent", () => {
    const categories = [
      { id: "food", parentId: null },
      { id: "eating-out", parentId: "food" },
      { id: "rent", parentId: null },
    ];
    expect(
      rollUpByParent(
        [
          { categoryId: "eating-out", amountMinor: 300 },
          { categoryId: "food", amountMinor: 200 },
          { categoryId: "rent", amountMinor: 400 },
          { categoryId: null, amountMinor: 50 },
        ],
        categories,
      ),
    ).toEqual([
      ["food", 500],
      ["rent", 400],
      [null, 50],
    ]);
  });

  test("areas with nothing to show are left out", () => {
    const rows = areaStats([{ id: "a" }, { id: "b" }], {
      spendingByArea: [{ areaId: "a", amountMinor: 100 }],
      hoursByArea: [],
      hourlyRates: [],
    });
    expect(rows.map((r) => r.area.id)).toEqual(["a"]);
  });

  test("every day of the period up to today, zeros included", () => {
    const span = reportSpan("this", "2026-10", ZONE);
    const days = spendingByDay([{ date: "2026-10-02", spentMinor: 900 }], span, "2026-10-03", ZONE);
    expect(days).toEqual([
      { date: "2026-10-01", spentMinor: 0 },
      { date: "2026-10-02", spentMinor: 900 },
      { date: "2026-10-03", spentMinor: 0 },
    ]);
    expect(spendingByDay([], reportSpan("last", "2026-10", ZONE), "2026-10-03", ZONE)).toHaveLength(
      30,
    );
  });

  test("day ticks stay sparse", () => {
    expect(dayTick("2026-10-01", 0, 31)).toBe("1");
    expect(dayTick("2026-10-02", 1, 31)).toBeUndefined();
    expect(dayTick("2026-10-08", 7, 31)).toBe("8");
  });
});

describe("payday plan", () => {
  const lines = [
    { categoryId: "rent", hasBudget: true, limitMinor: 1_200_000, rollover: false },
    { categoryId: "food", hasBudget: false, limitMinor: 0, rollover: true },
  ];

  test("fields start from this month's limits and each jar's suggestion, keeping edits", () => {
    const amounts = prefill({ rent: "10000" }, lines, [
      { id: "laptop", suggestedMonthlyMinor: 500_000 },
      { id: "trip", suggestedMonthlyMinor: null },
    ]);
    expect(amounts).toEqual({ rent: "10000", "goal:laptop": "5000" });
  });

  test("left to assign", () => {
    expect(leftToAssign("45000", { rent: "12000", "goal:laptop": "3000" })).toBe(3_000_000);
    expect(leftToAssign("", { rent: "100" })).toBe(-10_000);
    expect(leftToAssign("1000", { rent: "oops" })).toBe(100_000);
  });

  test("only lines given an amount are saved", () => {
    expect(budgetLines(lines, { rent: "12000", food: "" })).toEqual([
      { categoryId: "rent", limitMinor: 1_200_000, rollover: false },
    ]);
  });

  test("jars fill from the default account, never from their own", () => {
    const jars = [
      { id: "laptop", name: "Laptop", accountId: null },
      { id: "eid", name: "Eid", accountId: "cash" },
    ];
    const amounts = { "goal:laptop": "2000", "goal:eid": "500" };
    expect(jarMoves(jars, amounts, "cash")).toEqual([
      { goalId: "laptop", name: "Laptop", amountMinor: 200_000, fromAccountId: "cash" },
    ]);
    expect(jarMoves(jars, amounts, null)).toEqual([]);
  });
});

describe("shutdown", () => {
  const memory = () => {
    const data = new Map<string, string>();
    return {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
  };

  test("progress is kept for the day and starts fresh on a new one", () => {
    const storage = memory();
    saveProgress(storage, { date: "2026-10-30", step: 3, ticked: [{ id: "h" }], finished: true });
    expect(readProgress(storage, "2026-10-30")).toEqual({
      date: "2026-10-30",
      step: 3,
      ticked: [{ id: "h" }],
      finished: true,
    });
    expect(readProgress(storage, "2026-10-31")).toEqual(freshProgress("2026-10-31"));
  });

  test("unreadable progress is a fresh start", () => {
    expect(readProgress({ getItem: () => "{" }, "2026-10-30")).toEqual(freshProgress("2026-10-30"));
    expect(readProgress(undefined, "2026-10-30").step).toBe(0);
  });

  test("a timed task keeps its clock time on the new day, and its reminder moves with it", () => {
    const doAt = Date.UTC(2026, 9, 28, 11, 30); // 5:30 pm in Dhaka, two days ago
    const moved = carriedTo(
      { doAt, hasTime: true, reminderAt: doAt - 600_000 },
      "2026-10-31",
      ZONE,
    );
    const parts = localParts(moved.doAt, ZONE);
    expect([parts.day, parts.hour, parts.minute]).toEqual([31, 17, 30]);
    expect(moved.reminderAt).toBe(moved.doAt - 600_000);
  });

  test("an untimed task moves to the start of the day", () => {
    const moved = carriedTo(
      { doAt: startOfLocalDay("2026-10-30", ZONE), hasTime: false, reminderAt: null },
      "2026-10-31",
      ZONE,
    );
    expect(moved).toEqual({ doAt: startOfLocalDay("2026-10-31", ZONE), reminderAt: null });
  });

  test("picking never goes past three; unpicking puts it back on top", () => {
    const task = (id: string) => ({ id, top3Date: null });
    const data = {
      habitsUnchecked: [],
      tomorrowTopThree: [task("a"), task("b"), task("c")].map((t) => ({
        ...t,
        top3Date: "2026-10-31",
      })),
      tomorrowCandidates: [task("d")],
    };
    expect(withTopPicked(data, "d", "2026-10-31")).toBe(data);
    const unpicked = withTopUnpicked(data, "b");
    expect(unpicked.tomorrowTopThree.map((t) => t.id)).toEqual(["a", "c"]);
    expect(unpicked.tomorrowCandidates[0]).toEqual({ id: "b", top3Date: null });
  });
});

describe("gentle words", () => {
  test("a zero streak invites a start", () => {
    expect(streakText("Logging", 0)).toBe("Logging: start one today");
    expect(streakText("Logging", 3)).toBe("Logging: 3 days");
  });

  test("a quiet week gets one kind line", () => {
    expect(
      winLines({
        tasksDone: 0,
        topThreeDone: 0,
        topThreePlanned: 0,
        focusMinutes: 0,
        focusSessions: 0,
        highlights: 0,
        formatMinutes: String,
      }),
    ).toEqual(["A quiet week. Next week is a fresh start."]);
  });

  test("over plan shows the extra", () => {
    expect(planShare(90, 60)).toEqual({ filled: 60 / 90, extraMinutes: 30 });
  });
});

describe("AI cost", () => {
  test("dollars and cents", () => {
    expect(dollars(0)).toBe("$0.00");
    expect(dollars(5000)).toBe("<$0.01");
    expect(dollars(1_234_567)).toBe("$1.23");
    expect(cents(0)).toBe("0¢");
    expect(cents(4_000)).toBe("0.4¢");
    expect(cents(123_000)).toBe("12¢");
    expect(thousands(12_400)).toBe("12k");
  });

  test("every day of the month has a column", () => {
    const days = costByDay("2026-02", [{ date: "2026-02-03", costMicros: 9 }]);
    expect(days).toHaveLength(28);
    expect(days[2]).toEqual({ date: "2026-02-03", costMicros: 9 });
  });
});
