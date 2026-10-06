import { describe, expect, test } from "bun:test";
import { bestText, planShare, streakText, weekProgressText } from "../src/lib/gentle-progress";

describe("progress without guilt", () => {
  test("a zero streak invites a start instead of saying 0 days", () => {
    expect(streakText("Daily goal", 0)).toBe("Daily goal: start one today");
    expect(streakText("Daily goal", 3)).toBe("Daily goal: 3 days");
    expect(bestText(0)).toBeNull();
    expect(bestText(1, "week")).toBe("best 1 week");
  });

  test("a daily habit's week counts days done, never 'of 7'", () => {
    expect(weekProgressText(1, 7, true)).toBe("1 day this week");
    expect(weekProgressText(0, 7, true)).toBe("A fresh week");
    expect(weekProgressText(2, 3, false)).toBe("2 of 3 this week");
  });

  test("time beyond the plan is named as extra and drawn differently", () => {
    expect(planShare(30, 60)).toEqual({ filled: 0.5, extraMinutes: 0 });
    expect(planShare(660, 60)).toEqual({ filled: 60 / 660, extraMinutes: 600 });
    expect(planShare(0, 0)).toEqual({ filled: 0, extraMinutes: 0 });
  });
});
