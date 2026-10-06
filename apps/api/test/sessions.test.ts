import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { decode, sign } from "hono/jwt";
import { createSessionStore } from "../src/db/sessions";
import { LEGACY_TOKENS_UNTIL } from "../src/middleware/auth";
import { createTestContext, googleToken, JWT_SECRET } from "./helpers";

const DAY_MS = 86_400_000;
const as = (token: string) => ({ authorization: `Bearer ${token}` });

// The JWT's own expiry is checked against the real clock, so these tests run at real time.
const context = () => createTestContext({ now: Date.now() });

async function signIn(ctx: Awaited<ReturnType<typeof context>>, sub = "sub-s") {
  const res = await ctx.app.request("/auth/google", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken: googleToken(sub, `${sub}@example.com`) }),
  });
  return (await res.json()) as { token: string; expiresAt: number; user: { id: string } };
}

const errorCode = async (res: Response) =>
  ((await res.json()) as { error: { code: string } }).error.code;

describe("sessions", () => {
  test("sign-in issues a token naming a session", async () => {
    const ctx = await context();
    const { token, user } = await signIn(ctx);
    const { payload } = decode(token);
    expect(typeof payload.jti).toBe("string");
    const session = ctx.deps.users.sessions.find(payload.jti as string);
    expect(session).toMatchObject({ userId: user.id, revokedAt: null });
  });

  test("refresh returns a new token and retires the old one", async () => {
    const ctx = await context();
    const first = await signIn(ctx);
    const res = await ctx.app.request("/auth/refresh", {
      method: "POST",
      headers: as(first.token),
    });
    expect(res.status).toBe(200);
    const next = (await res.json()) as { token: string; expiresAt: number; user: { id: string } };
    expect(next.user.id).toBe(first.user.id);
    expect(next.token).not.toBe(first.token);
    expect(next.expiresAt).toBeGreaterThanOrEqual(first.expiresAt);
    expect(next.expiresAt - ctx.clock.now).toBeGreaterThan(29 * DAY_MS);

    // Requests already in flight with the old token still land...
    const inFlight = await ctx.request("GET", "/me", undefined, as(first.token));
    expect(inFlight.status).toBe(200);
    expect((await ctx.request("GET", "/me", undefined, as(next.token))).status).toBe(200);
    // ...and once the new token is in use, the old one has a minute left.
    ctx.clock.advance(30_000);
    expect((await ctx.request("GET", "/me", undefined, as(first.token))).status).toBe(200);
    ctx.clock.advance(31_000);
    const old = await ctx.request("GET", "/me", undefined, as(first.token));
    expect(old.status).toBe(401);
    expect(old.body).toMatchObject({ error: { code: "session_expired" } });
    expect((await ctx.request("GET", "/me", undefined, as(next.token))).status).toBe(200);
  });

  test("a refresh whose reply was lost leaves the old token working", async () => {
    const ctx = await context();
    const first = await signIn(ctx);
    const lost = await ctx.app.request("/auth/refresh", {
      method: "POST",
      headers: as(first.token),
    });
    expect(lost.status).toBe(200);
    // The phone never got the new token, so it never uses it.
    ctx.clock.advance(DAY_MS);
    expect((await ctx.request("GET", "/me", undefined, as(first.token))).status).toBe(200);
    const retry = await ctx.app.request("/auth/refresh", {
      method: "POST",
      headers: as(first.token),
    });
    expect(retry.status).toBe(200);
  });

  test("logout with the new token also ends the one it replaced", async () => {
    const ctx = await context();
    const first = await signIn(ctx);
    const res = await ctx.app.request("/auth/refresh", {
      method: "POST",
      headers: as(first.token),
    });
    const { token } = (await res.json()) as { token: string };
    await ctx.app.request("/auth/logout", { method: "POST", headers: as(token) });
    expect((await ctx.request("GET", "/me", undefined, as(first.token))).status).toBe(401);
    expect((await ctx.request("GET", "/me", undefined, as(token))).status).toBe(401);
  });

  test("logout revokes the session", async () => {
    const ctx = await context();
    const { token } = await signIn(ctx);
    const res = await ctx.app.request("/auth/logout", { method: "POST", headers: as(token) });
    expect(res.status).toBe(204);
    const after = await ctx.app.request("/settings", { headers: as(token) });
    expect(after.status).toBe(401);
    expect(await errorCode(after)).toBe("session_expired");
    // Signing out of one phone leaves another phone signed in.
    const other = await signIn(ctx);
    expect((await ctx.app.request("/settings", { headers: as(other.token) })).status).toBe(200);
  });

  test("a session past its expiry says session_expired", async () => {
    const ctx = await context();
    const { token } = await signIn(ctx);
    ctx.clock.advance(31 * DAY_MS);
    const res = await ctx.app.request("/settings", { headers: as(token) });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("session_expired");
  });

  test("an expired JWT says session_expired; a bad one says unauthorized", async () => {
    const ctx = await context();
    const { user } = await signIn(ctx);
    const past = Math.floor(Date.now() / 1000) - 60;
    const expired = await sign(
      { sub: user.id, jti: "x", iat: past - 60, exp: past },
      JWT_SECRET,
      "HS256",
    );
    const res = await ctx.app.request("/settings", { headers: as(expired) });
    expect(await errorCode(res)).toBe("session_expired");

    const forged = await sign(
      { sub: user.id, iat: past, exp: past + 3600 },
      "another-secret-another-secret-12345",
      "HS256",
    );
    const bad = await ctx.app.request("/settings", { headers: as(forged) });
    expect(bad.status).toBe(401);
    expect(await errorCode(bad)).toBe("unauthorized");
    const missing = await ctx.app.request("/settings");
    expect(await errorCode(missing)).toBe("unauthorized");
  });

  test("a session id that isn't on record is refused", async () => {
    const ctx = await context();
    const { user } = await signIn(ctx);
    const now = Math.floor(Date.now() / 1000);
    const made = await sign(
      { sub: user.id, jti: "01ARZ3NDEKTSV4RRFFQ69G5FAV", iat: now, exp: now + 3600 },
      JWT_SECRET,
      "HS256",
    );
    const res = await ctx.app.request("/settings", { headers: as(made) });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("session_expired");
  });

  test("a token from before sessions keeps working and refreshes into a session", async () => {
    const ctx = await context();
    const { user } = await signIn(ctx);
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign({ sub: user.id, iat: now, exp: now + 3600 }, JWT_SECRET, "HS256");
    // Before the cut-off, whatever today's date is when the test runs.
    ctx.clock.set(LEGACY_TOKENS_UNTIL - 86_400_000);
    expect((await ctx.app.request("/settings", { headers: as(legacy) })).status).toBe(200);
    const res = await ctx.app.request("/auth/refresh", { method: "POST", headers: as(legacy) });
    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(typeof decode(token).payload.jti).toBe("string");
  });

  test("a token from before sessions is refused after the cut-off", async () => {
    const ctx = await context();
    const { user } = await signIn(ctx);
    const now = Math.floor(Date.now() / 1000);
    const legacy = await sign({ sub: user.id, iat: now, exp: now + 3600 }, JWT_SECRET, "HS256");
    ctx.clock.set(LEGACY_TOKENS_UNTIL);
    const res = await ctx.app.request("/settings", { headers: as(legacy) });
    expect(res.status).toBe(401);
    expect(await errorCode(res)).toBe("session_expired");
  });

  test("refresh and logout need a token", async () => {
    const ctx = await context();
    for (const path of ["/auth/refresh", "/auth/logout"]) {
      const res = await ctx.app.request(path, { method: "POST" });
      expect(res.status).toBe(401);
      expect(await errorCode(res)).toBe("unauthorized");
    }
  });

  test("a users.db from before refresh grace gains the column and keeps its sessions", () => {
    const registry = new Database(":memory:");
    registry.exec(`CREATE TABLE sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL, last_used_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
      revoked_at INTEGER)`);
    registry.exec("INSERT INTO sessions VALUES ('s1', 'u1', 1, 1, 9999999999999, NULL)");
    const sessions = createSessionStore(registry, () => 2);
    expect(sessions.find("s1")).toMatchObject({ userId: "u1", replaces: null });
    sessions.create("s2", "u1", 9999999999999, "s1");
    expect(sessions.find("s2")?.replaces).toBe("s1");
  });
});
