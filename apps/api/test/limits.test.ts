import { describe, expect, test } from "bun:test";
import { loadEnv } from "../src/env";
import { SlidingWindowLimiter } from "../src/middleware/rate-limit";
import { FakeAi } from "./fake-ai";
import { createTestContext, JWT_SECRET, TEST_CLIENT_ID } from "./helpers";

/** A stand-in for the Bun server Hono gets as env, reporting the socket's peer. */
const peer = (address: string) => ({ requestIP: () => ({ address }) });

async function signInAttempts(
  env: Record<string, string>,
  send: { ip: string; peer?: string }[],
): Promise<number[]> {
  const ctx = await createTestContext({ env });
  const statuses: number[] = [];
  for (const { ip, peer: from } of send) {
    const res = await ctx.app.request(
      "/auth/google",
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-real-ip": ip },
        body: JSON.stringify({ idToken: "not-a-google-token-at-all" }),
      },
      from ? peer(from) : undefined,
    );
    statuses.push(res.status);
  }
  return statuses;
}

describe("the sign-in limiter", () => {
  test("ignores X-Real-IP unless TRUST_PROXY is on", async () => {
    // Six different claimed addresses from one client still share one bucket.
    const sends = Array.from({ length: 6 }, (_, i) => ({ ip: `10.0.0.${i}`, peer: "203.0.113.9" }));
    const statuses = await signInAttempts({}, sends);
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  test("with TRUST_PROXY, believes the header only from a loopback peer", async () => {
    const fromNginx = Array.from({ length: 6 }, (_, i) => ({
      ip: `10.0.0.${i}`,
      peer: "127.0.0.1",
    }));
    expect(await signInAttempts({ TRUST_PROXY: "true" }, fromNginx)).not.toContain(429);
    const direct = Array.from({ length: 6 }, (_, i) => ({
      ip: `10.0.0.${i}`,
      peer: "203.0.113.9",
    }));
    expect((await signInAttempts({ TRUST_PROXY: "true" }, direct))[5]).toBe(429);
  });

  test("forgets addresses whose window has passed", () => {
    const limiter = new SlidingWindowLimiter(5, 1000);
    for (let i = 0; i < 99; i++) limiter.attempt(`ip-${i}`, 0);
    expect(limiter.size).toBe(99);
    limiter.attempt("late", 5000);
    expect(limiter.size).toBe(1);
  });
});

describe("defaults", () => {
  test("the API listens on loopback and trusts no proxy unless told to", () => {
    const env = loadEnv({ GOOGLE_CLIENT_IDS: TEST_CLIENT_ID, JWT_SECRET });
    expect(env.HOST).toBe("127.0.0.1");
    expect(env.TRUST_PROXY).toBe(false);
  });
});

describe("the AI rate limit", () => {
  test("allows 30 AI requests a minute per user", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai, env: { AI_USER_MONTHLY_CAP_MICROS: "0" } });
    for (let i = 0; i < 32; i++) ai.queueJson({ subtasks: [] });
    for (let i = 0; i < 30; i++)
      expect((await ctx.request("POST", "/ai/breakdown", { title: "x" })).status).toBe(200);
    const over = await ctx.request("POST", "/ai/breakdown", { title: "x" });
    expect(over.status).toBe(429);
    expect(over.body).toMatchObject({ error: { code: "too_many_requests" } });
    // Reads are not limited, and another user has their own allowance.
    expect((await ctx.request("GET", "/ai/status")).status).toBe(200);
    const other = await ctx.tokenFor("sub-other", "other@example.com");
    const theirs = await ctx.request(
      "POST",
      "/ai/breakdown",
      { title: "x" },
      { authorization: `Bearer ${other}` },
    );
    expect(theirs.status).toBe(200);
    ctx.clock.advance(60_001);
    expect((await ctx.request("POST", "/ai/breakdown", { title: "x" })).status).toBe(200);
  });
});
