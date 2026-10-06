import { describe, expect, test } from "bun:test";
import { friendlyError } from "../src/lib/error-copy";

/** Same shape as lib/api.ts's ApiError, without pulling in the RPC client. */
function apiError(status: number, code: string, message: string) {
  return Object.assign(new Error(message), { name: "ApiError", status, code });
}

const unreachable = Object.assign(new Error("Can't reach http://10.0.2.2:3000"), {
  name: "ServerUnreachableError",
});

describe("friendlyError", () => {
  test("no connection on a queued write says it is kept, never shows the host", () => {
    const text = friendlyError(unreachable, "save");
    expect(text).toBe("Saved on this phone. It'll sync when you're back online.");
    expect(text).not.toContain("10.0.2.2");
  });

  test("no connection on a one-off action asks to check the internet", () => {
    expect(friendlyError(unreachable)).toContain("Check your internet");
  });

  test("a page that isn't our API (captive portal) reads as offline", () => {
    expect(friendlyError(apiError(200, "http_error", "Request failed (200)"), "load")).toContain(
      "Can't connect",
    );
  });

  test("a 500 never shows 'Request failed (500)'", () => {
    const text = friendlyError(apiError(500, "internal_error", "Request failed (500)"), "save");
    expect(text).toBe("Something went wrong on our side. Your change is kept and will retry.");
  });

  test("known codes get their own words", () => {
    expect(friendlyError(apiError(401, "session_expired", "jwt expired"))).toContain("Sign in");
    expect(friendlyError(apiError(404, "not_found", "Task not found"))).toContain(
      "no longer here",
    );
    expect(friendlyError(apiError(429, "ai_cap_reached", "cap"))).toContain("resets on the 1st");
  });

  test("validation details (field paths) stay hidden", () => {
    const text = friendlyError(apiError(400, "validation_error", "amountMinor: Expected number"));
    expect(text).not.toContain("amountMinor");
  });

  test("a bad_request message is already written for people and is kept", () => {
    expect(friendlyError(apiError(400, "bad_request", "Pick two different accounts"))).toBe(
      "Pick two different accounts",
    );
  });

  test("anything else falls back to a calm generic line", () => {
    expect(friendlyError(new TypeError("undefined is not a function"))).toBe(
      "Something went wrong. Try again.",
    );
    expect(friendlyError("boom")).toBe("Something went wrong. Try again.");
  });
});
