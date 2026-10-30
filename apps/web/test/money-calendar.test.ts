import { describe, expect, test } from "bun:test";
import {
  monthCells,
  spendBarPercent,
  stepDay,
  weekdayHeadings,
} from "../src/features/money/calendar-cells";

describe("spending calendar", () => {
  test("whole weeks from the user's first weekday", () => {
    // October 2026 starts on a Thursday; weeks start on Saturday (6).
    const cells = monthCells("2026-10", 6);
    expect(cells[0]).toBe("2026-09-26");
    expect(cells.length % 7).toBe(0);
    expect(cells).toContain("2026-10-31");
    expect(cells.at(-1)).toBe("2026-11-06");
    expect(monthCells("2026-10", 4)[0]).toBe("2026-10-01");
  });

  test("headings follow the first weekday", () => {
    expect(weekdayHeadings(6).map((d) => d.long)).toEqual([
      "Saturday",
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
    ]);
  });

  test("a spend bar is at least a fifth wide, none without spending", () => {
    expect(spendBarPercent(0, 1000)).toBe(0);
    expect(spendBarPercent(1, 1000)).toBe(20);
    expect(spendBarPercent(500, 1000)).toBe(50);
    expect(spendBarPercent(1000, 1000)).toBe(100);
  });

  test("arrow keys step a day or a week", () => {
    expect(stepDay("2026-10-31", "ArrowRight")).toBe("2026-11-01");
    expect(stepDay("2026-10-03", "ArrowUp")).toBe("2026-09-26");
    expect(stepDay("2026-10-03", "Enter")).toBeNull();
  });
});
