import { describe, expect, test } from "bun:test";
import { coldStartLocked } from "../src/features/security/lock-decision";

describe("app lock on a cold start", () => {
  test("the phone's copy locks before the settings have loaded", () => {
    expect(coldStartLocked(true, undefined)).toBe(true);
    expect(coldStartLocked(false, undefined)).toBe(false);
  });

  test("the phone's copy wins over a stale cached setting", () => {
    expect(coldStartLocked(true, false)).toBe(true);
  });

  test("with no copy yet (just updated), the settings decide once they arrive", () => {
    expect(coldStartLocked(null, undefined)).toBeNull();
    expect(coldStartLocked(null, true)).toBe(true);
  });
});
