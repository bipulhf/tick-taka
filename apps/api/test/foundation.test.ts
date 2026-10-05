import { describe, expect, test } from "bun:test";
import { createTestContext, googleToken } from "./helpers";

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

  test("Google sign-in returns a 30-day token that works", async () => {
    const { app, clock } = await createTestContext();
    const res = await app.request("/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: googleToken("sub-1", "Asha@Example.com") }),
    });
    expect(res.status).toBe(200);
    const { token, expiresAt, user, created } = (await res.json()) as {
      token: string;
      expiresAt: number;
      user: { email: string };
      created: boolean;
    };
    expect(expiresAt - clock.now).toBeGreaterThan(29 * 86_400_000);
    expect(user.email).toBe("asha@example.com");
    expect(created).toBe(true);
    const settings = await app.request("/settings", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(settings.status).toBe(200);
  });

  test("Google sign-in is limited to 10 attempts per 15 minutes per IP", async () => {
    const ctx = await createTestContext();
    const attempt = (ip: string, idToken = "not-a-google-token-at-all") =>
      ctx.app.request("/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ idToken }),
      });
    const good = googleToken("sub-1", "a@example.com");
    for (let i = 0; i < 10; i++) expect((await attempt("1.1.1.1")).status).toBe(401);
    const blocked = await attempt("1.1.1.1", good);
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBeTruthy();
    expect((await attempt("2.2.2.2", good)).status).toBe(200);
    ctx.clock.advance(15 * 60 * 1000 + 1);
    expect((await attempt("1.1.1.1", good)).status).toBe(200);
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

  test("a nullable setting can be cleared again", async () => {
    const { request } = await createTestContext();
    await request("PATCH", "/settings", { tikiOutfit: "cap", rewardTheme: "mint-breeze" });
    const cleared = await request<{ tikiOutfit: string | null; rewardTheme: string | null }>(
      "PATCH",
      "/settings",
      { tikiOutfit: null, rewardTheme: null },
    );
    expect(cleared.status).toBe(200);
    expect(cleared.body).toMatchObject({ tikiOutfit: null, rewardTheme: null });
    const again = await request<{ tikiOutfit: string | null }>("GET", "/settings");
    expect(again.body.tikiOutfit).toBeNull();
  });

  test("seed runs once", async () => {
    const { deps } = await createTestContext();
    const { seedDefaults } = await import("../src/db/seed");
    expect(seedDefaults(deps.db, deps.now())).toBe(false);
    const areas = deps.sqlite.query("select count(*) as n from areas").get() as { n: number };
    expect(areas.n).toBe(6);
  });
});
