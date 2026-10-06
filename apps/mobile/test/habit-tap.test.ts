import { describe, expect, test } from "bun:test";
import { habitTap, takeOneBack } from "../src/features/habits/habit-tap";

describe("habit ring taps", () => {
  test("below the target, a tap counts one more", () => {
    expect(habitTap(0, 8)).toEqual({ kind: "count", next: 1 });
    expect(habitTap(7, 8)).toEqual({ kind: "count", next: 8 });
  });

  test("at the target, an extra tap never resets the day", () => {
    expect(habitTap(8, 8)).toEqual({ kind: "atTarget" });
    expect(habitTap(1, 1)).toEqual({ kind: "atTarget" });
  });

  test("taking one back stops at zero", () => {
    expect(takeOneBack(8)).toBe(7);
    expect(takeOneBack(0)).toBe(0);
  });
});
