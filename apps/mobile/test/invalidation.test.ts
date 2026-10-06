import { describe, expect, test } from "bun:test";
import { keysToRefresh } from "../src/lib/invalidation";

describe("targeted refresh after writes", () => {
  test("a money write refreshes money screens and Today, not the task lists", () => {
    const keys = keysToRefresh(["/transactions"]);
    expect(keys).not.toBe("all");
    const set = keys as Set<string>;
    expect(set.has("transactions")).toBe(true);
    expect(set.has("budgets")).toBe(true);
    expect(set.has("today")).toBe(true);
    expect(set.has("tasks")).toBe(false);
  });

  test("a task write refreshes tasks and Today, not transactions", () => {
    const set = keysToRefresh(["/tasks/01ABC", "/habits/x/logs/2026-10-06"]) as Set<string>;
    expect(set.has("tasks")).toBe(true);
    expect(set.has("habits")).toBe(true);
    expect(set.has("today")).toBe(true);
    expect(set.has("transactions")).toBe(false);
  });

  test("settings and unknown routes refresh everything", () => {
    expect(keysToRefresh(["/tasks", "/settings"])).toBe("all");
    expect(keysToRefresh(["/something-new"])).toBe("all");
    expect(keysToRefresh(["/"])).toBe("all");
  });
});
