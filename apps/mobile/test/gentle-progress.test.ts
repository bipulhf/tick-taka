import { describe, expect, test } from "bun:test";
import {
  bestText,
  habitStreakText,
  planShare,
  streakText,
  weekProgressText,
  winLines,
} from "../src/lib/gentle-progress";

describe("progress without guilt", () => {
  test("a zero streak invites a start instead of saying 0 days", () => {
    expect(streakText("Daily goal", 0)).toBe("Daily goal: start one today");
    expect(streakText("Daily goal", 3)).toBe("Daily goal: 3 days");
    expect(bestText(0)).toBeNull();
    expect(bestText(1, "week")).toBe("best 1 week");
  });

  test("the weekly review never prints '0 days · best 0' or '1 days'", () => {
    expect(habitStreakText(0, 0)).toBe("A fresh start");
    expect(habitStreakText(0, 4)).toBe("A fresh start · best 4 days");
    expect(habitStreakText(1, 1)).toBe("🔥 1 day · best 1 day");
    expect(habitStreakText(2, 5, "week")).toBe("🔥 2 weeks · best 5 weeks");
  });

  test("weekly wins leave out the zeros", () => {
    const base = {
      tasksDone: 0,
      topThreeDone: 0,
      topThreePlanned: 3,
      focusMinutes: 0,
      focusSessions: 0,
      highlights: 0,
      formatMinutes: (m: number) => `${m}m`,
    };
    expect(winLines(base)).toEqual(["A quiet week. Next week is a fresh start."]);
    expect(winLines({ ...base, highlights: 2 })).toEqual([]);
    expect(
      winLines({ ...base, tasksDone: 1, topThreeDone: 1, focusMinutes: 25, focusSessions: 1 }),
    ).toEqual(["✓ 1 task finished", "⭐ 1 of 3 top-three tasks", "🌱 25m of focus in 1 session"]);
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
