import { describe, expect, test } from "bun:test";
import {
  addDays,
  addMonths,
  daysInMonth,
  daysLeftInMonth,
  eachDay,
  isLocalDate,
  localMonthRange,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
  zonedTimeToUtc,
} from "../src/dates";

const TZ = "Asia/Dhaka";

describe("dates", () => {
  test("local date respects Asia/Dhaka (+06:00)", () => {
    // 2026-10-03T19:30Z is 01:30 on 4 October in Dhaka
    expect(toLocalDate(Date.UTC(2026, 9, 3, 19, 30), TZ)).toBe("2026-10-04");
    expect(toLocalDate(Date.UTC(2026, 9, 3, 17, 59), TZ)).toBe("2026-10-03");
  });

  test("start of local day", () => {
    expect(startOfLocalDay("2026-10-04", TZ)).toBe(Date.UTC(2026, 9, 3, 18, 0));
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 17 }, TZ)).toBe(
      Date.UTC(2026, 9, 4, 11),
    );
  });

  test("works across DST zones", () => {
    const ms = zonedTimeToUtc({ year: 2026, month: 3, day: 29, hour: 12 }, "Europe/Berlin");
    expect(ms).toBe(Date.UTC(2026, 2, 29, 10));
  });

  test("calendar arithmetic", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysLeftInMonth("2026-10-04")).toBe(28);
    expect(daysLeftInMonth("2026-10-31")).toBe(1);
    expect(startOfWeek("2026-10-04", 6)).toBe("2026-10-03");
    expect(eachDay("2026-10-30", "2026-11-02")).toHaveLength(4);
  });

  test("validates local dates", () => {
    expect(isLocalDate("2026-02-29")).toBe(false);
    expect(isLocalDate("2028-02-29")).toBe(true);
    expect(isLocalDate("2026-10-4")).toBe(false);
  });

  test("month range is half-open", () => {
    const range = localMonthRange("2026-10", TZ);
    expect(range.from).toBe(Date.UTC(2026, 8, 30, 18));
    expect(range.to).toBe(Date.UTC(2026, 9, 31, 18));
  });
});
