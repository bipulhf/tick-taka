import { describe, expect, test } from "bun:test";
import { createTestContext } from "./helpers";

const WEB = "https://tick.example.com";

describe("CORS for the web app on its own host", () => {
  test("a listed origin may call the API, preflight included", async () => {
    const ctx = await createTestContext({ env: { WEB_ORIGINS: `${WEB}/, https://other.example` } });
    const preflight = await ctx.app.request("/tasks", {
      method: "OPTIONS",
      headers: {
        origin: WEB,
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "authorization, content-type",
      },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(preflight.headers.get("access-control-allow-methods")).toContain("PATCH");
    expect(preflight.headers.get("access-control-allow-headers")).toContain("authorization");
    // No cookies are used, so credentials are never allowed.
    expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();

    const res = await ctx.app.request("/tasks", { headers: { origin: WEB } });
    expect(res.status).toBe(401);
    expect(res.headers.get("access-control-allow-origin")).toBe(WEB);
  });

  test("other origins get no CORS headers", async () => {
    const ctx = await createTestContext({ env: { WEB_ORIGINS: WEB } });
    const res = await ctx.app.request("/health", { headers: { origin: "https://evil.example" } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("with no origins listed, no browser elsewhere may call it", async () => {
    const ctx = await createTestContext();
    const res = await ctx.app.request("/health", { headers: { origin: WEB } });
    expect(res.headers.get("access-control-allow-origin")).toBeNull();
  });
});
