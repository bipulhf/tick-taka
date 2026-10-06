import { describe, expect, test } from "bun:test";
import {
  describeRRule,
  firstOccurrence,
  formatRRule,
  nextOccurrence,
  parseClock,
  parseRecurrence,
  parseRRule,
} from "../src/recurrence";

describe("rrule text", () => {
  test("round-trips", () => {
    const text = "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;BYHOUR=10;BYMINUTE=0";
    expect(formatRRule(parseRRule(text))).toBe(text);
  });
  test("rejects unsupported rules", () => {
    expect(() => parseRRule("FREQ=HOURLY")).toThrow();
  });
});

describe("plain-words recurrence", () => {
  const cases: [string, string, string][] = [
    ["Internet bill every month on the 5th", "FREQ=MONTHLY;BYMONTHDAY=5", "Internet bill"],
    [
      "lab class every Sun and Tue 10am",
      "FREQ=WEEKLY;BYDAY=SU,TU;BYHOUR=10;BYMINUTE=0",
      "lab class",
    ],
    ["team sync every other Tuesday", "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU", "team sync"],
    ["water plants every 3 days", "FREQ=DAILY;INTERVAL=3", "water plants"],
    [
      "standup every weekday at 9:30am",
      "FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH;BYHOUR=9;BYMINUTE=30",
      "standup",
    ],
    ["review budget monthly", "FREQ=MONTHLY", "review budget"],
    ["pay rent on the 1st of every month", "FREQ=MONTHLY;BYMONTHDAY=1", "pay rent"],
    ["renew domain every year on Oct 4", "FREQ=YEARLY;BYMONTHDAY=4;BYMONTH=10", "renew domain"],
    ["backup every month on the last day", "FREQ=MONTHLY;BYMONTHDAY=-1", "backup"],
    ["read daily", "FREQ=DAILY", "read"],
  ];
  for (const [input, rrule, rest] of cases) {
    test(input, () => {
      const parsed = parseRecurrence(input);
      expect(parsed?.rrule).toBe(rrule);
      expect(parsed?.rest).toBe(rest);
    });
  }
  test("returns null without a recurrence", () => {
    expect(parseRecurrence("call bank tomorrow 5pm")).toBeNull();
  });
});

describe("occurrences", () => {
  test("every other Tuesday", () => {
    const rule = "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU";
    expect(firstOccurrence(rule, "2026-10-04")).toBe("2026-10-06");
    expect(nextOccurrence(rule, "2026-10-06")).toBe("2026-10-20");
  });
  test("monthly on the 31st clamps to short months", () => {
    const rule = "FREQ=MONTHLY;BYMONTHDAY=31";
    expect(nextOccurrence(rule, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence(rule, "2026-01-31", "2026-02-28")).toBe("2026-03-31");
  });
  test("monthly on the 5th from mid month", () => {
    expect(firstOccurrence("FREQ=MONTHLY;BYMONTHDAY=5", "2026-10-06")).toBe("2026-11-05");
    expect(firstOccurrence("FREQ=MONTHLY;BYMONTHDAY=5", "2026-10-05")).toBe("2026-10-05");
  });
  test("Sun and Tue", () => {
    const rule = "FREQ=WEEKLY;BYDAY=SU,TU";
    expect(nextOccurrence(rule, "2026-10-04")).toBe("2026-10-06");
    expect(nextOccurrence(rule, "2026-10-04", "2026-10-06")).toBe("2026-10-11");
  });
  test("daily interval", () => {
    expect(nextOccurrence("FREQ=DAILY;INTERVAL=3", "2026-10-04", "2026-10-05")).toBe("2026-10-07");
  });
  test("yearly", () => {
    expect(nextOccurrence("FREQ=YEARLY", "2028-02-29")).toBe("2029-02-28");
  });
});

describe("helpers", () => {
  test("parseClock", () => {
    expect(parseClock("5pm")).toEqual({ hour: 17, minute: 0 });
    expect(parseClock("12am")).toEqual({ hour: 0, minute: 0 });
    expect(parseClock("17:45")).toEqual({ hour: 17, minute: 45 });
    expect(parseClock("10")).toBeNull();
  });
  test("describe", () => {
    expect(describeRRule("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU")).toBe("Every other Tuesday");
    expect(describeRRule("FREQ=MONTHLY;BYMONTHDAY=5;BYHOUR=9;BYMINUTE=0")).toBe(
      "Every month on the 5th at 9 am",
    );
    expect(describeRRule("FREQ=MONTHLY;BYMONTHDAY=22")).toBe("Every month on the 22nd");
    expect(describeRRule("FREQ=DAILY;INTERVAL=3")).toBe("Every 3 days");
  });
});

describe("Bangla digits in repeat text (QA-011)", () => {
  test("read as 0-9", () => {
    expect(parseRecurrence("every ৩ days")?.rrule).toBe("FREQ=DAILY;INTERVAL=3");
    expect(parseRecurrence("x every month on the ৫th")?.rrule).toBe("FREQ=MONTHLY;BYMONTHDAY=5");
    expect(parseRecurrence("standup every Sun ১০am")?.rrule).toBe(
      "FREQ=WEEKLY;BYDAY=SU;BYHOUR=10;BYMINUTE=0",
    );
  });
});
