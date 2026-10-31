import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import {
  whyHabit,
  whyRecurring,
  whyShutdown,
  whyTask,
  whyWeeklyReview,
} from "../src/features/notifications/reminder-why";
import { accessFrom, askDecision } from "../src/lib/notification-ask";
import { sourceFiles } from "./helpers/source-files";

const state = (granted: boolean, canAskAgain: boolean, askedBefore: boolean) => ({
  granted,
  canAskAgain,
  askedBefore,
});

describe("asking for notifications once, in context", () => {
  test("asks only on a fresh install that hasn't allowed them yet", () => {
    expect(askDecision(state(false, true, false))).toBe("ask");
    expect(askDecision(state(true, true, false))).toBe("granted");
    expect(askDecision(state(true, false, true))).toBe("granted");
  });

  test("never nags: once asked, or once Android won't ask, it stays quiet", () => {
    expect(askDecision(state(false, true, true))).toBe("skip");
    expect(askDecision(state(false, false, false))).toBe("skip");
  });

  test("Settings shows the banner only after a no, not before anything needed it", () => {
    expect(accessFrom(state(false, true, false))).toBe("unasked");
    expect(accessFrom(state(false, true, true))).toBe("denied");
    expect(accessFrom(state(false, false, false))).toBe("denied");
    expect(accessFrom(state(true, false, true))).toBe("granted");
  });

  test("nothing asks just because the app opened", () => {
    const asking = sourceFiles()
      .filter((f) => f.text.includes("requestPermissionsAsync"))
      .map((f) => f.path);
    expect(asking).toEqual(["lib/notifications.ts"]);
  });
});

describe("the line before Android's prompt", () => {
  const TZ = "Asia/Dhaka";
  const now = zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 8 }, TZ);
  const at = (day: number, hour: number) =>
    zonedTimeToUtc({ year: 2026, month: 10, day, hour }, TZ);

  test("says when the task will ring", () => {
    expect(whyTask(at(6, 9), now, TZ)).toBe("Tick & Taka can remind you at 9:00 am.");
    expect(whyTask(at(7, 18), now, TZ)).toBe("Tick & Taka can remind you tomorrow at 6:00 pm.");
    expect(whyTask(at(9, 9), now, TZ)).toBe("Tick & Taka can remind you on Fri 9 Oct at 9:00 am.");
  });

  test("bills, habits and reviews", () => {
    expect(whyRecurring("bill", 2)).toBe(
      "Tick & Taka can remind you 2 days before and on the day it's due, at 9:00 am.",
    );
    expect(whyRecurring("income", 0)).toBe(
      "Tick & Taka can remind you on the day it's expected, at 9:00 am.",
    );
    expect(whyHabit("18:30")).toBe("Tick & Taka can nudge you at 6:30 pm.");
    expect(whyShutdown("21:30")).toBe("Tick & Taka can remind you to close the day at 9:30 pm.");
    expect(whyWeeklyReview("Friday", "17:00")).toBe(
      "Tick & Taka can remind you every Friday at 5:00 pm.",
    );
  });
});
