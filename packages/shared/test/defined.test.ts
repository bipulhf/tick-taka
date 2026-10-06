import { describe, expect, test } from "bun:test";
import { defined } from "../src/defined";

describe("defined", () => {
  test("passes values through, falsy ones included", () => {
    expect(defined(0, "zero")).toBe(0);
    expect(defined("", "empty")).toBe("");
    expect(defined(false, "false")).toBe(false);
  });

  test("throws with the name of what was missing", () => {
    expect(() => defined(undefined, "the session row")).toThrow(
      "Expected the session row to exist",
    );
    expect(() => defined(null, "x")).toThrow("Expected x to exist");
  });
});
