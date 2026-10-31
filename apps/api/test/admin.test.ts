import { describe, expect, test } from "bun:test";
import { FakeAi } from "./fake-ai";
import { createTestContext, googleToken } from "./helpers";

const as = (token: string) => ({ authorization: `Bearer ${token}` });
/** The test user (test@example.com) is the owner. */
const OWNER = { env: { OWNER_EMAIL: "test@example.com" } };

describe("admin area", () => {
  test("only the owner may open it, and /me says who is admin", async () => {
    const ctx = await createTestContext(OWNER);
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    expect((await ctx.request("GET", "/admin/overview")).status).toBe(200);
    expect((await ctx.request("GET", "/admin/users", undefined, as(asha))).status).toBe(403);
    expect((await ctx.request<{ isAdmin: boolean }>("GET", "/me")).body.isAdmin).toBe(true);
    const me = await ctx.request<{ isAdmin: boolean }>("GET", "/me", undefined, as(asha));
    expect(me.body.isAdmin).toBe(false);

    const noOwner = await createTestContext();
    expect((await noOwner.request("GET", "/admin/overview")).status).toBe(403);
  });

  test("users and usage show account facts and counts, never record content", async () => {
    const ctx = await createTestContext(OWNER);
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    await ctx.request("POST", "/tasks", { title: "Asha's secret plan", status: "open" }, as(asha));
    await ctx.request("POST", "/tasks", { title: "Another", status: "open" }, as(asha));

    const users = await ctx.request<{ email: string; isOwner: boolean }[]>("GET", "/admin/users");
    expect(users.body.map((u) => u.email).sort()).toEqual(["asha@example.com", "test@example.com"]);
    expect(users.body.find((u) => u.email === "test@example.com")?.isOwner).toBe(true);

    const usage = await ctx.request<{
      perUser: { email: string; counts: { tasks: number } }[];
      totals: { kind: string; total: number }[];
    }>("GET", "/admin/usage");
    expect(usage.body.perUser.find((u) => u.email === "asha@example.com")?.counts.tasks).toBe(2);
    expect(usage.body.totals.find((t) => t.kind === "tasks")?.total).toBeGreaterThanOrEqual(2);
    for (const path of ["/admin/users", "/admin/usage", "/admin/overview", "/admin/health"]) {
      const text = JSON.stringify((await ctx.request("GET", path)).body);
      expect(text).not.toContain("secret plan");
    }

    const overview = await ctx.request<{ users: number; activeToday: number }>(
      "GET",
      "/admin/overview",
    );
    expect(overview.body.users).toBe(2);
    const health = await ctx.request<{ requests: { requests: number } }>("GET", "/admin/health");
    expect(health.body.requests.requests).toBeGreaterThan(0);
  });

  test("blocking signs a user out everywhere and keeps them out", async () => {
    const ctx = await createTestContext(OWNER);
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    const id = ctx.deps.users.list().find((u) => u.email === "asha@example.com")!.id;
    expect((await ctx.request("PATCH", `/admin/users/${id}`, { blocked: true })).status).toBe(200);
    const after = await ctx.request<{ error: { code: string } }>(
      "GET",
      "/tasks",
      undefined,
      as(asha),
    );
    expect(after.status).toBe(401);
    const again = await ctx.app.request("/auth/google", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ idToken: googleToken("sub-asha", "asha@example.com") }),
    });
    expect(again.status).toBe(403);
    expect(((await again.json()) as { error: { code: string } }).error.code).toBe(
      "account_blocked",
    );
  });

  test("sign-out and delete act on others, never on the owner", async () => {
    const ctx = await createTestContext(OWNER);
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    const users = ctx.deps.users.list();
    const ashaId = users.find((u) => u.email === "asha@example.com")!.id;
    const ownerId = users.find((u) => u.email === "test@example.com")!.id;

    expect((await ctx.request("POST", `/admin/users/${ashaId}/sign-out`)).status).toBe(204);
    expect((await ctx.request("GET", "/tasks", undefined, as(asha))).status).toBe(401);

    expect((await ctx.request("PATCH", `/admin/users/${ownerId}`, { blocked: true })).status).toBe(
      400,
    );
    expect((await ctx.request("POST", `/admin/users/${ownerId}/sign-out`)).status).toBe(400);

    const wrong = await ctx.request("DELETE", `/admin/users/${ashaId}`, {
      confirmEmail: "nope@example.com",
    });
    expect(wrong.status).toBe(400);
    const gone = await ctx.request("DELETE", `/admin/users/${ashaId}`, {
      confirmEmail: "ASHA@example.com",
    });
    expect(gone.status).toBe(204);
    expect(ctx.deps.users.find(ashaId)).toBeUndefined();
  });

  test("invite-only lets in the invited and the existing, and refuses the rest", async () => {
    const ctx = await createTestContext(OWNER);
    await ctx.tokenFor("sub-old", "old@example.com");
    expect((await ctx.request("PUT", "/admin/access", { mode: "invite" })).status).toBe(200);
    await ctx.request("POST", "/admin/access/emails", { email: "Invited@Example.com" });
    const signIn = (sub: string, email: string) =>
      ctx.app.request("/auth/google", {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": sub },
        body: JSON.stringify({ idToken: googleToken(sub, email) }),
      });
    expect((await signIn("sub-stranger", "stranger@example.com")).status).toBe(403);
    expect((await signIn("sub-old", "old@example.com")).status).toBe(200);
    expect((await signIn("sub-invited", "invited@example.com")).status).toBe(200);
    const access = await ctx.request<{ emails: { email: string }[] }>("GET", "/admin/access");
    expect(access.body.emails.map((e) => e.email)).toEqual(["invited@example.com"]);
  });

  test("a per-user AI switch and cap override the user's own settings", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ...OWNER, ai });
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    const id = ctx.deps.users.list().find((u) => u.email === "asha@example.com")!.id;
    await ctx.request("PATCH", `/admin/users/${id}`, { aiDisabled: true });
    const refused = await ctx.request<{ error: { code: string } }>(
      "POST",
      "/ai/breakdown",
      { title: "x" },
      as(asha),
    );
    expect(refused.body.error.code).toBe("ai_disabled");

    await ctx.request("PATCH", `/admin/users/${id}`, { aiDisabled: false, aiCapMicros: 5_000 });
    const status = await ctx.request<{ monthlyCapMicros: number | null }>(
      "GET",
      "/ai/status",
      undefined,
      as(asha),
    );
    expect(status.body.monthlyCapMicros).toBe(5_000);
    // The owner is never limited.
    const own = await ctx.request<{ monthlyCapMicros: number | null }>("GET", "/ai/status");
    expect(own.body.monthlyCapMicros).toBeNull();
  });
});
