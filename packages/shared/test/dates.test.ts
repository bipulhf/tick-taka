import { describe, expect, test } from "bun:test";
import {
  addDays,
  addMonths,
  DAY_MS,
  DEFAULT_TIME_ZONE,
  daysInMonth,
  daysLeftInMonth,
  diffDays,
  eachDay,
  endOfLocalDay,
  firstDayOfMonth,
  HOUR_MS,
  isLocalDate,
  isLocalMonth,
  isTimeZone,
  lastDayOfMonth,
  localDayRange,
  localMinuteOfDay,
  localMonthRange,
  localParts,
  MINUTE_MS,
  monthOf,
  parseLocalDate,
  safeTimeZone,
  startOfLocalDay,
  startOfWeek,
  timeZoneOffsetMs,
  toLocalDate,
  toLocalMonth,
  weekdayOf,
  zonedTimeToUtc,
} from "../src/dates";

const TZ = "Asia/Dhaka";
// 2026-10-04 10:15:30 in Dhaka (+06:00)
const SUNDAY_MORNING = Date.UTC(2026, 9, 4, 4, 15, 30);

describe("dates", () => {
  test("only zones the clock can use count as time zones", () => {
    expect(isTimeZone("Asia/Dhaka")).toBe(true);
    expect(isTimeZone("UTC")).toBe(true);
    expect(isTimeZone("Not/AZone")).toBe(false);
    expect(isTimeZone("Dhaka")).toBe(false);
    expect(isTimeZone("")).toBe(false);
    expect(safeTimeZone("Europe/London")).toBe("Europe/London");
    expect(safeTimeZone("Not/AZone")).toBe(DEFAULT_TIME_ZONE);
    expect(safeTimeZone(null)).toBe(DEFAULT_TIME_ZONE);
  });

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

/*
 * Every export is called directly, with and without its default arguments. Bun 1.3's
 * line coverage marks a whole module as unexecuted from its first line down to any
 * function with a default parameter that no test calls, so a single untested helper
 * here used to report 0 % lines for the file.
 */
describe("dates: every helper", () => {
  test("constants", () => {
    expect(DEFAULT_TIME_ZONE).toBe("Asia/Dhaka");
    expect(DAY_MS).toBe(24 * HOUR_MS);
    expect(HOUR_MS).toBe(60 * MINUTE_MS);
  });

  test("localParts reads wall-clock fields and the weekday", () => {
    expect(localParts(SUNDAY_MORNING, TZ)).toEqual({
      year: 2026,
      month: 10,
      day: 4,
      hour: 10,
      minute: 15,
      second: 30,
      weekday: 0,
    });
    // Default zone is Dhaka
    expect(localParts(SUNDAY_MORNING)).toEqual(localParts(SUNDAY_MORNING, TZ));
    // Midnight is hour 0, never 24
    expect(localParts(Date.UTC(2026, 9, 3, 18, 0), TZ).hour).toBe(0);
    expect(localParts(Date.UTC(2026, 9, 3, 18, 0), "UTC").weekday).toBe(6);
  });

  test("timeZoneOffsetMs", () => {
    expect(timeZoneOffsetMs(SUNDAY_MORNING, TZ)).toBe(6 * HOUR_MS);
    expect(timeZoneOffsetMs(SUNDAY_MORNING)).toBe(6 * HOUR_MS);
    expect(timeZoneOffsetMs(SUNDAY_MORNING, "UTC")).toBe(0);
    expect(timeZoneOffsetMs(Date.UTC(2026, 0, 15), "Europe/Berlin")).toBe(HOUR_MS);
    expect(timeZoneOffsetMs(Date.UTC(2026, 6, 15), "Europe/Berlin")).toBe(2 * HOUR_MS);
    expect(timeZoneOffsetMs(Date.UTC(2026, 0, 15), "America/New_York")).toBe(-5 * HOUR_MS);
    // Sub-second instants do not skew the offset
    expect(timeZoneOffsetMs(SUNDAY_MORNING + 999, TZ)).toBe(6 * HOUR_MS);
  });

  test("zonedTimeToUtc defaults hour and minute to 0 and the zone to Dhaka", () => {
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 4 })).toBe(Date.UTC(2026, 9, 3, 18));
    expect(zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10, minute: 15 }, TZ)).toBe(
      Date.UTC(2026, 9, 4, 4, 15),
    );
    expect(zonedTimeToUtc({ year: 2026, month: 1, day: 1 }, "America/New_York")).toBe(
      Date.UTC(2026, 0, 1, 5),
    );
  });

  test("toLocalDate and toLocalMonth", () => {
    expect(toLocalDate(SUNDAY_MORNING)).toBe("2026-10-04");
    expect(toLocalMonth(SUNDAY_MORNING)).toBe("2026-10");
    expect(toLocalMonth(Date.UTC(2026, 9, 31, 18, 30), TZ)).toBe("2026-11");
    expect(toLocalMonth(Date.UTC(2026, 9, 31, 18, 30), "UTC")).toBe("2026-10");
  });

  test("isLocalMonth", () => {
    expect(isLocalMonth("2026-10")).toBe(true);
    expect(isLocalMonth("2026-12")).toBe(true);
    expect(isLocalMonth("2026-00")).toBe(false);
    expect(isLocalMonth("2026-13")).toBe(false);
    expect(isLocalMonth("2026-1")).toBe(false);
    expect(isLocalMonth("2026-10-01")).toBe(false);
  });

  test("parseLocalDate", () => {
    expect(parseLocalDate("2026-10-04")).toEqual({ year: 2026, month: 10, day: 4 });
    expect(() => parseLocalDate("4 Oct")).toThrow("Invalid local date: 4 Oct");
  });

  test("diffDays and weekdayOf", () => {
    expect(diffDays("2026-10-01", "2026-10-31")).toBe(30);
    expect(diffDays("2026-10-31", "2026-10-01")).toBe(-30);
    expect(diffDays("2026-12-31", "2027-01-01")).toBe(1);
    expect(weekdayOf("2026-10-04")).toBe(0);
    expect(weekdayOf("2026-10-10")).toBe(6);
  });

  test("startOfWeek defaults to Saturday", () => {
    expect(startOfWeek("2026-10-04")).toBe("2026-10-03");
    expect(startOfWeek("2026-10-03")).toBe("2026-10-03");
    expect(startOfWeek("2026-10-04", 1)).toBe("2026-09-28");
    expect(startOfWeek("2026-10-04", 0)).toBe("2026-10-04");
  });

  test("month helpers", () => {
    expect(monthOf("2026-10-04")).toBe("2026-10");
    expect(firstDayOfMonth("2026-02")).toBe("2026-02-01");
    expect(lastDayOfMonth("2026-02")).toBe("2026-02-28");
    expect(lastDayOfMonth("2028-02")).toBe("2028-02-29");
    expect(lastDayOfMonth("2026-12")).toBe("2026-12-31");
    expect(addMonths("2026-10", 0)).toBe("2026-10");
    expect(addMonths("2026-10", 15)).toBe("2028-01");
    expect(() => addMonths("Oct", 1)).toThrow("Invalid local month: Oct");
    expect(() => daysInMonth("2026-1")).toThrow("Invalid local month: 2026-1");
  });

  test("local day ranges", () => {
    expect(startOfLocalDay("2026-10-04")).toBe(Date.UTC(2026, 9, 3, 18));
    expect(endOfLocalDay("2026-10-04")).toBe(Date.UTC(2026, 9, 4, 18));
    expect(endOfLocalDay("2026-10-04", "UTC")).toBe(Date.UTC(2026, 9, 5));
    expect(localDayRange("2026-10-04")).toEqual({
      from: Date.UTC(2026, 9, 3, 18),
      to: Date.UTC(2026, 9, 4, 18),
    });
    expect(localDayRange("2026-10-04", "UTC")).toEqual({
      from: Date.UTC(2026, 9, 4),
      to: Date.UTC(2026, 9, 5),
    });
    expect(localMonthRange("2026-12")).toEqual({
      from: Date.UTC(2026, 10, 30, 18),
      to: Date.UTC(2026, 11, 31, 18),
    });
  });

  test("a DST day is 23 hours long", () => {
    const range = localDayRange("2026-03-29", "Europe/Berlin");
    expect(range.to - range.from).toBe(23 * HOUR_MS);
  });

  test("eachDay is inclusive and empty when reversed", () => {
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
    expect(eachDay("2026-10-04", "2026-10-04")).toEqual(["2026-10-04"]);
    expect(eachDay("2026-10-05", "2026-10-04")).toEqual([]);
  });

  test("localMinuteOfDay", () => {
    expect(localMinuteOfDay(SUNDAY_MORNING)).toBe(10 * 60 + 15);
    expect(localMinuteOfDay(SUNDAY_MORNING, "UTC")).toBe(4 * 60 + 15);
    expect(localMinuteOfDay(Date.UTC(2026, 9, 3, 18), TZ)).toBe(0);
  });
});
