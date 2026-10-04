import { describe, expect, test } from "bun:test";
import { calmTip, greeting, tikiMood } from "../src/tiki";

describe("tiki", () => {
  const base = {
    hour: 10,
    topThreeTotal: 3,
    topThreeDone: 1,
    focusRunning: false,
    leftTodayMinor: null,
  };
  test("moods follow the spec", () => {
    expect(tikiMood({ ...base, hour: 23 })).toBe("sleepy");
    expect(tikiMood({ ...base, topThreeDone: 3 })).toBe("proud");
    expect(tikiMood({ ...base, leftTodayMinor: -100 })).toBe("calm");
    expect(tikiMood({ ...base, leftTodayMinor: 5000 })).toBe("relaxed");
    expect(tikiMood({ ...base, focusRunning: true })).toBe("focused");
    expect(tikiMood(base)).toBe("happy");
  });
  test("greeting and stable tips", () => {
    expect(greeting(9)).toBe("Good morning");
    expect(greeting(18)).toBe("Good evening");
    expect(calmTip("2026-10-04")).toBe(calmTip("2026-10-04"));
  });
});
