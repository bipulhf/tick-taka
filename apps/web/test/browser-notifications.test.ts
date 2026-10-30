import { expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { nextDaily, nextWeekly, parsePrefs } from "../src/features/settings/browser-notifications";

const DHAKA = "Asia/Dhaka";
// Friday 30 Oct 2026, 10:00 in Dhaka.
const NOW = zonedTimeToUtc({ year: 2026, month: 10, day: 30, hour: 10, minute: 0 }, DHAKA);
const at = (day: number, hour: number, minute = 0) =>
  zonedTimeToUtc({ year: 2026, month: 10, day, hour, minute }, DHAKA);

test("prefs start off, and stored ones keep any kind they don't mention", () => {
  expect(parsePrefs(null).enabled).toBe(false);
  const prefs = parsePrefs(JSON.stringify({ enabled: true, kinds: { shutdown: false } }));
  expect(prefs).toEqual({
    enabled: true,
    kinds: { focus: true, shutdown: false, weeklyReview: true },
  });
  expect(parsePrefs("{broken").enabled).toBe(false);
});

test("the daily shutdown rings later today, or tomorrow once it has passed", () => {
  expect(nextDaily("21:30", NOW, DHAKA)).toBe(at(30, 21, 30));
  expect(nextDaily("09:00", NOW, DHAKA)).toBe(at(31, 9));
});

test("the weekly review finds its next weekday", () => {
  // Sunday 1 Nov.
  expect(nextWeekly(0, "19:00", NOW, DHAKA)).toBe(at(31, 19) + 86_400_000);
  // Friday: later today, or a week on once it has passed.
  expect(nextWeekly(5, "19:00", NOW, DHAKA)).toBe(at(30, 19));
  expect(nextWeekly(5, "09:00", NOW, DHAKA)).toBe(at(30, 9) + 7 * 86_400_000);
});
