import { describe, expect, test } from "bun:test";
import { createTestContext, TEST_PASSWORD } from "./helpers";

describe("foundation", () => {
  test("health needs no auth", async () => {
    const { app } = await createTestContext();
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  test("protected routes need a token", async () => {
    const { app } = await createTestContext();
    const res = await app.request("/settings");
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({
      error: { code: "unauthorized", message: "Missing sign-in token" },
    });
    const bad = await app.request("/settings", { headers: { authorization: "Bearer nope" } });
    expect(bad.status).toBe(401);
  });

  test("unknown endpoints use the error envelope", async () => {
    const { request } = await createTestContext();
    const res = await request("GET", "/nope");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "not_found", message: "No such endpoint" } });
  });

  test("login returns a 30-day token that works", async () => {
    const { app } = await createTestContext();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: TEST_PASSWORD }),
    });
    expect(res.status).toBe(200);
    const { token, expiresAt } = (await res.json()) as { token: string; expiresAt: number };
    expect(expiresAt - Date.now()).toBeGreaterThan(29 * 86_400_000);
    const settings = await app.request("/settings", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(settings.status).toBe(200);
  });

  test("login is limited to 5 attempts per 15 minutes per IP", async () => {
    const ctx = await createTestContext();
    const attempt = (ip: string, password = "wrong") =>
      ctx.app.request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ password }),
      });
    for (let i = 0; i < 5; i++) expect((await attempt("1.1.1.1")).status).toBe(401);
    const blocked = await attempt("1.1.1.1", TEST_PASSWORD);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await attempt("2.2.2.2", TEST_PASSWORD)).status).toBe(200);
    ctx.clock.advance(15 * 60 * 1000 + 1);
    expect((await attempt("1.1.1.1", TEST_PASSWORD)).status).toBe(200);
  });

  test("validation errors use the error envelope", async () => {
    const { request } = await createTestContext();
    const res = await request("PATCH", "/settings", { dailyTaskGoal: -1 });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "validation_error" } });
  });

  test("settings merge over defaults and patch only sent keys", async () => {
    const { request } = await createTestContext();
    const initial = await request<{ timeZone: string; vacationMode: boolean }>("GET", "/settings");
    expect(initial.body.timeZone).toBe("Asia/Dhaka");
    await request("PATCH", "/settings", { vacationMode: true });
    await request("PATCH", "/settings", { dailyTaskGoal: 3 });
    const after = await request<{ vacationMode: boolean; dailyTaskGoal: number }>(
      "GET",
      "/settings",
    );
    expect(after.body).toMatchObject({ vacationMode: true, dailyTaskGoal: 3 });
  });

  test("seed runs once", async () => {
    const { deps } = await createTestContext();
    const { seedDefaults } = await import("../src/db/seed");
    expect(seedDefaults(deps.db, deps.now())).toBe(false);
    const areas = deps.sqlite.query("select count(*) as n from areas").get() as { n: number };
    expect(areas.n).toBe(6);
  });
});
