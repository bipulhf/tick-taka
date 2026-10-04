import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "../src/dates";
import { deferPastQuietHours, isInQuietHours } from "../src/quiet-hours";

const TZ = "Asia/Dhaka";
const at = (day: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month: 10, day, hour, minute }, TZ);
const quiet = { start: "23:00", end: "07:00" };

describe("quiet hours", () => {
  test("window wraps midnight", () => {
    expect(isInQuietHours(at(4, 23, 30), quiet, TZ)).toBe(true);
    expect(isInQuietHours(at(4, 6, 59), quiet, TZ)).toBe(true);
    expect(isInQuietHours(at(4, 7, 0), quiet, TZ)).toBe(false);
    expect(isInQuietHours(at(4, 21, 30), quiet, TZ)).toBe(false);
  });
  test("deferred to when quiet hours end", () => {
    expect(deferPastQuietHours(at(4, 23, 30), quiet, TZ)).toBe(at(5, 7));
    expect(deferPastQuietHours(at(5, 2, 0), quiet, TZ)).toBe(at(5, 7));
    expect(deferPastQuietHours(at(5, 9, 0), quiet, TZ)).toBe(at(5, 9));
  });
  test("daytime windows work too", () => {
    expect(isInQuietHours(at(4, 13), { start: "12:00", end: "14:00" }, TZ)).toBe(true);
  });
});
