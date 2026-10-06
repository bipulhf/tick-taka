import { describe, expect, test } from "bun:test";
import { apiErrorFrom } from "../src/lib/api";

describe("reading an error reply (CQ-022)", () => {
  test("our API's envelope gives its code and message", () => {
    const error = apiErrorFrom(404, { error: { code: "not_found", message: "Task not found" } });
    expect([error.status, error.code, error.message]).toEqual([404, "not_found", "Task not found"]);
  });

  test("anything else is a reply from something in front of the server", () => {
    // A proxy's or captive portal's JSON, a half-matching shape, or no JSON at all.
    for (const body of [
      null,
      "<html>502</html>",
      { error: "Bad gateway" },
      { error: { code: 502, message: "Bad gateway" } },
      { error: { code: "not_found" } },
      { message: "Not found" },
    ]) {
      const error = apiErrorFrom(502, body);
      expect([error.code, error.message]).toEqual(["http_error", "Request failed (502)"]);
    }
  });
});
