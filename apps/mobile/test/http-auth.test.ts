import { afterAll, beforeAll, describe, expect, test } from "bun:test";

type HttpModule = typeof import("../src/lib/http");
let http: HttpModule;
let token = "new";
let expired = 0;

const realFetch = globalThis.fetch;
afterAll(() => {
  globalThis.fetch = realFetch;
});

beforeAll(async () => {
  // Every request answers 401, as a server does for an expired or revoked session.
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: { code: "session_expired", message: "Sign in again" } }), {
      status: 401,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  http = await import("../src/lib/http");
  http.connectAuth({ token: () => token, onUnauthorized: () => expired++ });
});

describe("401 handling", () => {
  test("a 401 for the current token marks the session expired", async () => {
    expired = 0;
    const response = await http.request(http.apiUrl("/tasks"), { method: "POST", json: {} });
    expect(response.status).toBe(401);
    expect(expired).toBe(1);
  });

  test("a 401 for a token that was refreshed meanwhile is ignored", async () => {
    expired = 0;
    await http.request(http.apiUrl("/tasks"), { headers: { authorization: "Bearer old" } });
    expect(expired).toBe(0);
  });

  test("a refused Google sign-in is not an expired session", async () => {
    expired = 0;
    await http.request(http.apiUrl("/auth/google"), { method: "POST", json: {} });
    expect(expired).toBe(0);
  });

  test("a refused token refresh is", async () => {
    expired = 0;
    token = "current";
    await http.request(http.apiUrl("/auth/refresh"), { method: "POST" });
    expect(expired).toBe(1);
  });
});
