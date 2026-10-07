import { describe, expect, test } from "bun:test";
import { clockLabel, clockOptions, withCurrentOption } from "../src/components/ui/picker-options";

const goals = [
  { id: "3", label: "3 tasks" },
  { id: "5", label: "5 tasks" },
];

describe("withCurrentOption", () => {
  test("a preset value leaves the options as they are", () => {
    expect(withCurrentOption(goals, "5")).toBe(goals);
  });

  test("no value, or the none option, adds nothing", () => {
    expect(withCurrentOption(goals, null)).toBe(goals);
    expect(withCurrentOption(goals, "")).toBe(goals);
  });

  test("a value set elsewhere is listed first, labelled by describe", () => {
    expect(withCurrentOption(goals, "4", (n) => `${n} tasks`)).toEqual([
      { id: "4", label: "4 tasks" },
      ...goals,
    ]);
  });

  test("a habit frequency Tiki set outside the presets reads as a frequency", () => {
    const perWeek = [2, 3, 4, 5, 6].map((n) => ({ id: String(n), label: `${n}× a week` }));
    expect(withCurrentOption(perWeek, "7", (n) => `${n}× a week`)[0]).toEqual({
      id: "7",
      label: "7× a week",
    });
  });

  test("without describe the value labels itself (an emoji from Tiki)", () => {
    expect(withCurrentOption([{ id: "💧", label: "💧" }], "🦄")[0]).toEqual({
      id: "🦄",
      label: "🦄",
    });
  });
});

describe("clock labels", () => {
  test("24-hour ids read as the app's 12-hour times", () => {
    expect(clockLabel("21:00")).toBe("9:00 pm");
    expect(clockLabel("22:30")).toBe("10:30 pm");
    expect(clockLabel("00:00")).toBe("12:00 am");
    expect(clockLabel("06:05")).toBe("6:05 am");
    expect(clockLabel("12:00")).toBe("12:00 pm");
  });

  test("options keep the HH:mm id", () => {
    expect(clockOptions(["07:00", "13:00"])).toEqual([
      { id: "07:00", label: "7:00 am" },
      { id: "13:00", label: "1:00 pm" },
    ]);
  });
});
