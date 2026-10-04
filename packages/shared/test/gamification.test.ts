import { describe, expect, test } from "bun:test";
import { addDays, eachDay } from "../src/dates";
import {
  computeStreak,
  levelFromSparks,
  sparksForLevel,
  unlockedRewards,
} from "../src/gamification";

describe("levels", () => {
  test("thresholds grow", () => {
    expect(sparksForLevel(1)).toBe(0);
    expect(sparksForLevel(2)).toBe(100);
    expect(levelFromSparks(99).level).toBe(1);
    expect(levelFromSparks(100).level).toBe(2);
    expect(levelFromSparks(350)).toMatchObject({ level: 3, progress: 50 / 300 });
    expect(unlockedRewards(3).map((r) => r.id)).toEqual(["cap", "mint-breeze"]);
  });
});

describe("streaks", () => {
  const today = "2026-10-20";

  test("today in progress never breaks the streak", () => {
    const done = eachDay("2026-10-10", "2026-10-19");
    expect(computeStreak({ schedule: "daily", doneDates: done, today }).current).toBe(10);
    expect(computeStreak({ schedule: "daily", doneDates: [...done, today], today }).current).toBe(
      11,
    );
  });

  test("two freeze days a month bridge misses", () => {
    const done = eachDay("2026-10-01", "2026-10-19").filter(
      (d) => d !== "2026-10-12" && d !== "2026-10-15",
    );
    const result = computeStreak({ schedule: "daily", doneDates: done, today });
    expect(result.current).toBe(17);
    expect(result.freezesUsedThisMonth).toBe(2);
    expect(result.freezesLeftThisMonth).toBe(0);
  });

  test("a third miss in the month ends the streak", () => {
    const misses = new Set(["2026-10-12", "2026-10-15", "2026-10-17"]);
    const done = eachDay("2026-10-01", "2026-10-19").filter((d) => !misses.has(d));
    expect(computeStreak({ schedule: "daily", doneDates: done, today }).current).toBe(5);
  });

  test("freezes that bridge nothing are not counted", () => {
    const done = ["2026-10-19"];
    const result = computeStreak({ schedule: "daily", doneDates: done, today });
    expect(result.current).toBe(1);
    expect(result.freezesUsedThisMonth).toBe(0);
  });

  test("days off and vacation are neutral", () => {
    const done = eachDay("2026-10-10", "2026-10-19").filter((d) => d !== "2026-10-16");
    const result = computeStreak({
      schedule: "daily",
      doneDates: done,
      today,
      skipDates: ["2026-10-16"],
      freezesPerMonth: 0,
    });
    expect(result.current).toBe(9);
  });

  test("n per week counts weeks", () => {
    // Weeks start Saturday. Three done days in each of the last three full weeks.
    const weeks = ["2026-09-26", "2026-10-03", "2026-10-10"];
    const done = weeks.flatMap((start) => [start, addDays(start, 2), addDays(start, 4)]);
    const result = computeStreak({
      schedule: "n_per_week",
      perWeek: 3,
      doneDates: done,
      today,
      freezesPerMonth: 0,
    });
    expect(result).toMatchObject({ current: 3, unit: "week" });
  });
});
