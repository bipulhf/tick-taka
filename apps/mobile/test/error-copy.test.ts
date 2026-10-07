import { describe, expect, test } from "bun:test";
import { friendlyError } from "../src/lib/error-copy";

/** Same shape as lib/api.ts's ApiError, without pulling in the RPC client. */
function apiError(status: number, code: string, message: string, fromProxy = false) {
  return Object.assign(new Error(message), { name: "ApiError", status, code, fromProxy });
}
/** A reply that wasn't our API's envelope, as apiErrorFrom makes it. */
const proxyError = (status: number) =>
  apiError(status, "http_error", `Request failed (${status})`, true);

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
    expect(friendlyError(proxyError(200), "load")).toContain("Can't connect");
    expect(friendlyError(proxyError(502), "save")).toBe(
      "Saved on this phone. It'll sync when you're back online.",
    );
  });

  // CQ-045: our API's own envelope is never read as "offline", whatever its code.
  test("an API refusal with an http_error code doesn't claim the change is kept", () => {
    const text = friendlyError(
      apiError(400, "http_error", "Malformed JSON in request body"),
      "save",
    );
    expect(text).not.toContain("Saved on this phone");
    expect(text).not.toContain("Malformed");
  });

  // UX-054: a write refused as too large has been dropped; it must not read as kept.
  test("a write too large to send says it wasn't saved", () => {
    const tooBig = "That change is too big to send, so it wasn't saved.";
    for (const status of [413, 414, 431])
      expect(friendlyError(proxyError(status), "save")).toBe(tooBig);
    expect(friendlyError(apiError(413, "payload_too_large", "Payload Too Large"), "save")).toBe(
      tooBig,
    );
    // An upload or other one-off action keeps its own words.
    expect(friendlyError(proxyError(413), "action")).toBe(
      "That file is too big. Try a smaller photo.",
    );
  });

  test("a 500 never shows 'Request failed (500)'", () => {
    const text = friendlyError(apiError(500, "internal_error", "Request failed (500)"), "save");
    expect(text).toBe("Something went wrong on our side. Your change is kept and will retry.");
  });

  test("known codes get their own words", () => {
    expect(friendlyError(apiError(401, "session_expired", "jwt expired"))).toContain("Sign in");
    expect(friendlyError(apiError(404, "not_found", "Task not found"))).toContain("no longer here");
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

  test("sign-in: Google's refusal keeps its words, never 'You're signed out'", () => {
    const refused = apiError(401, "unauthorized", "Verify this Google account's email first");
    expect(friendlyError(refused, "signIn")).toBe("Verify this Google account's email first");
    expect(friendlyError(apiError(401, "unauthorized", ""), "signIn")).toContain("Google sign-in");
    expect(friendlyError(apiError(503, "internal_error", "Request failed (503)"), "signIn")).toBe(
      "Something went wrong on our side. Try signing in again in a moment.",
    );
    expect(friendlyError(unreachable, "signIn")).toContain("Check your internet");
    expect(friendlyError(apiError(429, "too_many_attempts", "Too many"), "signIn")).toContain(
      "Too many tries",
    );
  });

  test("anything else falls back to a calm generic line", () => {
    expect(friendlyError(new TypeError("undefined is not a function"))).toBe(
      "Something went wrong. Try again.",
    );
    expect(friendlyError("boom")).toBe("Something went wrong. Try again.");
  });
});
