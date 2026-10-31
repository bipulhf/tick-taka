import { describe, expect, test } from "bun:test";
import { AI_GROUPS, isAiGroupOn, setAiGroup } from "../src/ai-groups";
import { AI_FEATURES } from "../src/schemas/settings";

describe("AI switch groups", () => {
  test("every feature belongs to exactly one group", () => {
    const grouped = AI_GROUPS.flatMap((group) => [...group.features]);
    expect([...grouped].sort()).toEqual([...AI_FEATURES].sort());
  });

  test("the groups hold the features the switches promise", () => {
    expect(AI_GROUPS.map((g) => [g.label, [...g.features]])).toEqual([
      ["Chat and voice", ["assistant"]],
      ["Smart capture", ["parse", "receipt"]],
      ["Planning and coaching", ["planDay", "breakdown", "weeklyReview", "budgetSuggestions"]],
    ]);
  });

  test("a group is on when no flag in it is off", () => {
    expect(isAiGroupOn({}, "capture")).toBe(true);
    expect(isAiGroupOn({ parse: true, receipt: true }, "capture")).toBe(true);
  });

  test("a mixed group (one feature off from before) shows as off", () => {
    expect(isAiGroupOn({ receipt: false }, "capture")).toBe(false);
    expect(isAiGroupOn({ budgetSuggestions: false, planDay: true }, "planning")).toBe(false);
    // Other groups aren't affected.
    expect(isAiGroupOn({ receipt: false }, "planning")).toBe(true);
  });

  test("switching a group sets every feature in it and leaves the rest", () => {
    const mixed = { receipt: false, assistant: false };
    expect(setAiGroup(mixed, "capture", true)).toEqual({
      parse: true,
      receipt: true,
      assistant: false,
    });
    expect(setAiGroup({}, "planning", false)).toEqual({
      planDay: false,
      breakdown: false,
      weeklyReview: false,
      budgetSuggestions: false,
    });
    expect(isAiGroupOn(setAiGroup(mixed, "chat", true), "chat")).toBe(true);
  });

  test("the input flags aren't changed", () => {
    const before = { parse: false };
    setAiGroup(before, "capture", true);
    expect(before).toEqual({ parse: false });
  });
});
