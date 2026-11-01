import { describe, expect, test } from "bun:test";
import {
  eventDays,
  eventPace,
  eventPhase,
  eventTotals,
  groupEvents,
} from "../src/features/money/event-groups";

const today = "2026-11-01";
const event = (startsOn: string, endsOn: string, spentMinor = 0) => ({
  startsOn,
  endsOn,
  spentMinor,
});
const trip = event("2026-10-30", "2026-11-04", 1500);
const picnic = event("2026-12-12", "2026-12-12");
const eid = event("2026-11-20", "2026-11-22");
const wedding = event("2026-09-18", "2026-09-20", 1770);
const boishakh = event("2025-04-14", "2025-04-14", 999);

describe("events", () => {
  test("active, upcoming and past, in a useful order", () => {
    expect(eventPhase(event(today, today), today)).toBe("active");
    const groups = groupEvents([wedding, picnic, trip, boishakh, eid], today);
    expect(groups.map((g) => [g.key, g.items])).toEqual([
      ["active", [trip]],
      ["upcoming", [eid, picnic]],
      ["past", [wedding, boishakh]],
    ]);
  });
  test("days left, days until, days since", () => {
    expect(eventDays(trip, today)).toBe(3);
    expect(eventDays(event(today, today), today)).toBe(0);
    expect(eventDays(eid, today)).toBe(19);
    expect(eventDays(wedding, today)).toBe(42);
  });
  test("how far through an active event today is", () => {
    expect(eventPace(trip, today)).toBe(3 / 6);
    expect(eventPace(event(today, today), today)).toBe(1);
  });
  test("the strip counts now and next, and this year's spending", () => {
    expect(eventTotals([wedding, picnic, trip, boishakh, eid], today)).toEqual({
      active: 1,
      upcoming: 2,
      next: eid,
      spentThisYearMinor: 3270,
      eventsThisYear: 4,
    });
  });
});
