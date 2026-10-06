import { describe, expect, test } from "bun:test";
import { DEFAULT_TIME_ZONE, DEFAULT_WEEK_STARTS_ON } from "@tick-taka/shared/dates";
import { userTime } from "../src/lib/user-time";

describe("userTime", () => {
  test("uses the shared defaults while settings are loading", () => {
    expect(userTime(undefined)).toEqual({
      timeZone: DEFAULT_TIME_ZONE,
      weekStartsOn: DEFAULT_WEEK_STARTS_ON,
    });
  });

  test("uses the user's own zone and first weekday once loaded", () => {
    expect(userTime({ timeZone: "Asia/Kathmandu", weekStartsOn: 1 })).toEqual({
      timeZone: "Asia/Kathmandu",
      weekStartsOn: 1,
    });
  });

  test("a Sunday start (0) is kept, not replaced by the default", () => {
    expect(userTime({ timeZone: "Asia/Dhaka", weekStartsOn: 0 }).weekStartsOn).toBe(0);
  });
});
