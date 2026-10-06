import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { sign } from "hono/jwt";
import { openDatabase } from "../src/db/client";
import { seedDefaults } from "../src/db/seed";
import { createUserRegistry } from "../src/db/user-registry";
import { loadEnv } from "../src/env";
import { runHourlyJobs } from "../src/jobs/scheduler";
import { FakeAi } from "./fake-ai";
import { createTestContext, googleToken, JWT_SECRET, TEST_CLIENT_ID } from "./helpers";

const as = (token: string) => ({ authorization: `Bearer ${token}` });

describe("separate users", () => {
  test("each user sees only their own records", async () => {
    const ctx = await createTestContext();
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    const bilal = await ctx.tokenFor("sub-bilal", "bilal@example.com");
    const created = await ctx.request<{ id: string }>(
      "POST",
      "/tasks",
      { title: "Asha's secret task", status: "open" },
      as(asha),
    );
    expect(created.status).toBe(201);
    const bilalTasks = await ctx.request<{ title: string }[]>(
      "GET",
      "/tasks",
      undefined,
      as(bilal),
    );
    expect(bilalTasks.body.map((t) => t.title)).not.toContain("Asha's secret task");
    const peek = await ctx.request("GET", `/tasks/${created.body.id}`, undefined, as(bilal));
    expect(peek.status).toBe(404);
    const edit = await ctx.request(
      "PATCH",
      `/tasks/${created.body.id}`,
      { title: "hijacked" },
      as(bilal),
    );
    expect(edit.status).toBe(404);
    const ashaTasks = await ctx.request<{ title: string }[]>("GET", "/tasks", undefined, as(asha));
    expect(ashaTasks.body.map((t) => t.title)).toContain("Asha's secret task");
  });

  test("a new user starts with their own seeded areas and settings", async () => {
    const ctx = await createTestContext();
    await ctx.request("PATCH", "/settings", { dailyTaskGoal: 9 });
    const fresh = await ctx.tokenFor("sub-new", "new@example.com");
    const areas = await ctx.request<unknown[]>("GET", "/areas", undefined, as(fresh));
    expect(areas.body).toHaveLength(6);
    const settings = await ctx.request<{ dailyTaskGoal: number }>(
      "GET",
      "/settings",
      undefined,
      as(fresh),
    );
    expect(settings.body.dailyTaskGoal).not.toBe(9);
  });

  test("receipts are served only to their owner", async () => {
    const ctx = await createTestContext();
    const other = await ctx.tokenFor("sub-other", "other@example.com");
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.jpg", { type: "image/jpeg" }),
    );
    const res = await ctx.app.request("/uploads", {
      method: "POST",
      body: form,
      headers: as(ctx.token),
    });
    const { path } = (await res.json()) as { path: string };
    expect((await ctx.app.request(`/uploads/${path}`, { headers: as(ctx.token) })).status).toBe(
      200,
    );
    expect((await ctx.app.request(`/uploads/${path}`, { headers: as(other) })).status).toBe(404);
  });

  test("receipts refuse a token in the query string", async () => {
    const ctx = await createTestContext();
    const form = new FormData();
    form.append(
      "file",
      new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], "r.jpg", { type: "image/jpeg" }),
    );
    const res = await ctx.app.request("/uploads", {
      method: "POST",
      body: form,
      headers: as(ctx.token),
    });
    const { path } = (await res.json()) as { path: string };
    const viaQuery = await ctx.app.request(`/uploads/${path}?token=${ctx.token}`);
    expect(viaQuery.status).toBe(401);
    expect(await viaQuery.json()).toMatchObject({ error: { code: "unauthorized" } });
  });

  test("/me names the signed-in user", async () => {
    const ctx = await createTestContext();
    const me = await ctx.request<{ email: string }>("GET", "/me");
    expect(me.body.email).toBe("test@example.com");
  });

  test("signing in again with the same Google account reuses the user", async () => {
    const ctx = await createTestContext();
    const signIn = async () => {
      const res = await ctx.app.request("/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken: googleToken("sub-again", "again@example.com") }),
      });
      return (await res.json()) as { user: { id: string }; created: boolean };
    };
    const first = await signIn();
    const second = await signIn();
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.user.id).toBe(first.user.id);
  });

  test("tokens without a known user are refused", async () => {
    const ctx = await createTestContext();
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign({ sub: "me", iat: now, exp: now + 60 }, JWT_SECRET, "HS256");
    const res = await ctx.request("GET", "/settings", undefined, as(legacy));
    expect(res.status).toBe(401);
  });
});

describe("the owner's single-user data", () => {
  test("goes to OWNER_EMAIL on first sign-in, and only to them", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-owner-"));
    const env = loadEnv({
      DB_PATH: join(dir, "app.db"),
      GOOGLE_CLIENT_IDS: TEST_CLIENT_ID,
      JWT_SECRET,
      OWNER_EMAIL: "Owner@Example.com",
    });
    const legacy = openDatabase(env.DB_PATH);
    seedDefaults(legacy.db, Date.now());
    legacy.sqlite.exec("update areas set name = 'From before' where sort = 0");
    legacy.sqlite.close();

    const users = createUserRegistry(env, Date.now);
    const stranger = users.signIn({ sub: "s", email: "x@example.com", name: null, picture: null });
    const owner = users.signIn({ sub: "o", email: "owner@example.com", name: null, picture: null });
    expect(stranger.user.legacy).toBe(false);
    expect(owner.user.legacy).toBe(true);
    const ownerArea = users
      .data(owner.user)
      .sqlite.query("select name from areas where sort = 0")
      .get() as { name: string };
    expect(ownerArea.name).toBe("From before");
    const strangerArea = users
      .data(stranger.user)
      .sqlite.query("select name from areas where sort = 0")
      .get() as { name: string };
    expect(strangerArea.name).not.toBe("From before");
    expect(existsSync(join(dir, "users", `${stranger.user.id}.db`))).toBe(true);
  });
});

describe("AI budget", () => {
  test("one user's spending doesn't count against another's", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai, env: { AI_USER_MONTHLY_CAP_MICROS: "500" } });
    const other = await ctx.tokenFor("sub-other", "other@example.com");
    ai.queueJson({ subtasks: [] });
    await ctx.request("POST", "/ai/breakdown", { title: "x" });
    const mine = await ctx.request<{ capReached: boolean }>("GET", "/ai/status");
    const theirs = await ctx.request<{ capReached: boolean; monthSpendMicros: number }>(
      "GET",
      "/ai/status",
      undefined,
      as(other),
    );
    expect(mine.body.capReached).toBe(true);
    expect(theirs.body).toMatchObject({ capReached: false, monthSpendMicros: 0 });
  });

  test("the usage report splits a user's own cost by day and feature; only the owner sees everyone", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai, env: { OWNER_EMAIL: "test@example.com" } });
    const other = await ctx.tokenFor("sub-other", "other@example.com");
    ai.queueJson({ subtasks: [] }, { subtasks: [] });
    await ctx.request("POST", "/ai/breakdown", { title: "x" });
    await ctx.request("POST", "/ai/breakdown", { title: "y" }, as(other));

    type Report = {
      month: string;
      calls: number;
      costMicros: number;
      byDay: { date: string; calls: number }[];
      byFeature: { feature: string; calls: number; inputTokens: number }[];
      users: { email: string; me: boolean; calls: number }[] | null;
    };
    const mine = await ctx.request<Report>("GET", "/ai/usage");
    expect(mine.body).toMatchObject({ month: "2026-10", calls: 1 });
    expect(mine.body.costMicros).toBeGreaterThan(0);
    expect(mine.body.byDay).toEqual([expect.objectContaining({ date: "2026-10-04", calls: 1 })]);
    expect(mine.body.byFeature).toEqual([
      expect.objectContaining({ feature: "breakdown", calls: 1, inputTokens: 1000 }),
    ]);
    expect(mine.body.users?.map((u) => [u.email, u.me, u.calls])).toEqual([
      ["test@example.com", true, 1],
      ["other@example.com", false, 1],
    ]);

    const theirs = await ctx.request<Report>("GET", "/ai/usage", undefined, as(other));
    expect(theirs.body.users).toBeNull();
    const before = await ctx.request<Report>("GET", "/ai/usage?month=2026-09");
    expect(before.body).toMatchObject({ month: "2026-09", calls: 0, byDay: [] });
  });
});

describe("nightly jobs", () => {
  test("back up each user at 3 am in their own time zone", async () => {
    const backups = mkdtempSync(join(tmpdir(), "tt-jobs-"));
    // 3:05 am in Dhaka is 9:05 pm the day before in London.
    const at = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 3, minute: 5 }, "Asia/Dhaka");
    const ctx = await createTestContext({ now: at, env: { BACKUPS_DIR: backups } });
    const london = await ctx.tokenFor("sub-london", "london@example.com");
    await ctx.request("PATCH", "/settings", { timeZone: "Europe/London" }, as(london));
    runHourlyJobs(ctx.deps);
    const dhakaUser = ctx.deps.users.list()[0]!;
    const londonUser = ctx.deps.users.list()[1]!;
    expect(readdirSync(join(backups, "users", dhakaUser.id))).toEqual(["app-2026-10-04.db"]);
    expect(existsSync(join(backups, "users", londonUser.id))).toBe(false);
  });
});
