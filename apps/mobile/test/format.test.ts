import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  formatAmount,
  formatLocalDate,
  formatMinutes,
  formatTimer,
  formatWhen,
  numeralsStore,
} from "../src/lib/format";

const now = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, "Asia/Dhaka");

describe("format", () => {
  test("relative days with optional time", () => {
    expect(
      formatWhen(
        zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 17 }, "Asia/Dhaka"),
        true,
        now,
      ),
    ).toBe("Tomorrow, 5:00 pm");
    expect(formatWhen(now, false, now)).toBe("Today");
    expect(
      formatWhen(zonedTimeToUtc({ year: 2026, month: 10, day: 8 }, "Asia/Dhaka"), false, now),
    ).toBe("Thu 8 Oct");
  });
  test("durations and timers", () => {
    expect(formatMinutes(150)).toBe("2h 30m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatTimer(25 * 60_000)).toBe("25:00");
    expect(formatTimer(3_725_000)).toBe("1:02:05");
  });
  test("local dates", () => {
    expect(formatLocalDate("2026-10-04", "long")).toBe("Sunday, 4 Oct");
  });
  test("amounts use lakh grouping for taka", () => {
    expect(formatAmount(27_249_000)).toBe("৳2,72,490");
    expect(formatAmount(1_234_567_800)).toBe("৳1,23,45,678");
    expect(formatAmount(12_345_678, { currency: "USD" })).toBe("$123,456.78");
  });
});

describe("the numbers setting", () => {
  test("amounts follow it; an explicit option still wins", () => {
    try {
      expect(formatAmount(125_000)).toBe("৳1,250");
      numeralsStore.set("beng");
      expect(formatAmount(125_000)).toBe("৳১,২৫০");
      expect(formatAmount(-5_000, { numerals: "latn" })).toBe("−৳50");
    } finally {
      numeralsStore.set("latn");
    }
  });
});
