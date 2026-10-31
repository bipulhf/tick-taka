import { describe, expect, test } from "bun:test";
import { DEFAULT_SETTINGS } from "../src/schemas/settings";
import { isWeeklyReviewDay, weeklyReviewHint } from "../src/weekly-review";

describe("weekly review day", () => {
  test("defaults to Friday at 7 pm", () => {
    expect(DEFAULT_SETTINGS.weeklyReviewDay).toBe(5);
    expect(DEFAULT_SETTINGS.weeklyReviewTime).toBe("19:00");
  });

  test("follows the setting", () => {
    // 30 Oct 2026 is a Friday, 29 Oct a Thursday.
    expect(isWeeklyReviewDay("2026-10-30", 5)).toBe(true);
    expect(isWeeklyReviewDay("2026-10-29", 5)).toBe(false);
    expect(isWeeklyReviewDay("2026-10-29", 4)).toBe(true);
  });

  test("names the day", () => {
    expect(weeklyReviewHint(5)).toBe("It's Friday, a good day for it");
    expect(weeklyReviewHint(0)).toBe("It's Sunday, a good day for it");
  });
});
