import { afterAll, describe, expect, test } from "bun:test";
import {
  dateFieldLabel,
  dateFromLocal,
  localFromDate,
  withinBounds,
} from "../src/components/ui/calendar-dates";

const zone = process.env.TZ;
afterAll(() => {
  process.env.TZ = zone;
});

describe("calendar days", () => {
  for (const tz of ["Asia/Dhaka", "UTC", "America/Los_Angeles", "Pacific/Kiritimati"]) {
    test(`a day survives the trip through Date in ${tz}`, () => {
      process.env.TZ = tz;
      for (const day of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31", "2028-02-29"]) {
        const date = dateFromLocal(day);
        expect(date?.getHours()).toBe(12);
        expect(localFromDate(date as Date)).toBe(day);
      }
    });
  }

  test("a day the calendar draws at midnight reads as that day", () => {
    process.env.TZ = "Asia/Dhaka";
    expect(localFromDate(new Date(2026, 10, 1))).toBe("2026-11-01");
    expect(localFromDate(new Date(2026, 10, 1, 23, 59))).toBe("2026-11-01");
  });

  test("an empty or broken value is no day at all", () => {
    expect(dateFromLocal("")).toBeUndefined();
    expect(dateFromLocal("2026-02-30")).toBeUndefined();
    expect(dateFromLocal("1 Nov")).toBeUndefined();
  });

  test("the field names the day, and the year only when it isn't this one", () => {
    expect(dateFieldLabel("2026-10-05", "2026-11-01")).toBe("Mon 5 Oct");
    expect(dateFieldLabel("2027-01-04", "2026-11-01")).toBe("Mon 4 Jan 2027");
  });

  test("bounds are inclusive and optional", () => {
    expect(withinBounds("2026-11-01")).toBe(true);
    expect(withinBounds("2026-11-01", "2026-11-01", "2026-11-01")).toBe(true);
    expect(withinBounds("2026-10-31", "2026-11-01")).toBe(false);
    expect(withinBounds("2026-11-02", undefined, "2026-11-01")).toBe(false);
  });
});
