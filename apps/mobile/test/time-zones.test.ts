import { describe, expect, test } from "bun:test";
import { DEFAULT_TIME_ZONE, isTimeZone } from "@tick-taka/shared/dates";
import { settingsPatchSchema } from "@tick-taka/shared/schemas/settings";
import {
  COMMON_TIME_ZONES,
  gmtOffset,
  phoneTimeZone,
  timeZoneCity,
  timeZoneLabel,
  timeZoneOptions,
} from "../src/features/settings/time-zones";

const JULY = Date.UTC(2026, 6, 1);
const JANUARY = Date.UTC(2026, 0, 15);

describe("time zone setting", () => {
  test("every offered zone is one the clock and the settings schema accept", () => {
    expect(COMMON_TIME_ZONES[0]).toBe(DEFAULT_TIME_ZONE);
    for (const zone of COMMON_TIME_ZONES) {
      expect({ zone, ok: isTimeZone(zone) }).toEqual({ zone, ok: true });
      expect(settingsPatchSchema.safeParse({ timeZone: zone }).success).toBe(true);
    }
    expect(settingsPatchSchema.safeParse({ timeZone: "Mars/Olympus" }).success).toBe(false);
  });

  test("zones read as a city and its offset, including half hours and summer time", () => {
    expect(timeZoneLabel("Asia/Dhaka", JULY)).toBe("Dhaka · GMT+6");
    expect(gmtOffset("Asia/Kathmandu", JULY)).toBe("GMT+5:45");
    expect(gmtOffset("Europe/London", JANUARY)).toBe("GMT");
    expect(gmtOffset("Europe/London", JULY)).toBe("GMT+1");
    expect(gmtOffset("America/New_York", JANUARY)).toBe("GMT-5");
    expect(timeZoneCity("Asia/Kuala_Lumpur")).toBe("Kuala Lumpur");
  });

  test("the phone's zone comes first and is named as the phone's", () => {
    const options = timeZoneOptions("Europe/Lisbon", JULY);
    expect(options[0]).toEqual({ id: "Europe/Lisbon", label: "Lisbon · GMT+1 (this phone)" });
    expect(options).toHaveLength(COMMON_TIME_ZONES.length + 1);
  });

  test("a phone on a listed zone isn't listed twice", () => {
    const options = timeZoneOptions("Asia/Dhaka", JULY);
    expect(options.filter((o) => o.id === "Asia/Dhaka")).toEqual([
      { id: "Asia/Dhaka", label: "Dhaka · GMT+6 (this phone)" },
    ]);
    expect(options).toHaveLength(COMMON_TIME_ZONES.length);
  });

  test("a phone zone that can't be read or used is ignored", () => {
    expect(phoneTimeZone(() => "Europe/Berlin")).toBe("Europe/Berlin");
    expect(phoneTimeZone(() => undefined)).toBeNull();
    expect(phoneTimeZone(() => "Not/AZone")).toBeNull();
    expect(
      phoneTimeZone(() => {
        throw new Error("no Intl");
      }),
    ).toBeNull();
    expect(timeZoneOptions(null, JULY)).toHaveLength(COMMON_TIME_ZONES.length);
  });
});
