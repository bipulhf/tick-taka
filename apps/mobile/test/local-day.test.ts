import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { latestToday, msUntilNextLocalMidnight, nextDateCheckMs } from "../src/lib/local-day";

const TZ = "Asia/Dhaka";

describe("Today turns over at local midnight", () => {
  test("23:59 in Dhaka is one minute from the new day", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 23, minute: 59 }, TZ);
    expect(msUntilNextLocalMidnight(now, TZ)).toBe(60_000);
    expect(nextDateCheckMs(now, TZ)).toBe(60_500);
  });

  test("midday checks again within five minutes, not twelve hours", () => {
    const now = zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 12 }, TZ);
    expect(msUntilNextLocalMidnight(now, TZ)).toBe(12 * 3_600_000);
    expect(nextDateCheckMs(now, TZ)).toBe(5 * 60_000);
  });

  test("offline the next morning, the newest cached day is shown until today loads", () => {
    const days = [
      { date: "2026-10-05" },
      undefined,
      { date: "2026-10-06" },
      { date: "2026-10-04" },
    ];
    expect(latestToday(days)?.date).toBe("2026-10-06");
    expect(latestToday([])).toBeUndefined();
  });
});
