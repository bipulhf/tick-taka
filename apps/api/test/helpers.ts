import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import type { AiClient } from "../src/ai/client";
import { createApp } from "../src/app";
import { createUserRegistry, type GoogleProfile } from "../src/db/user-registry";
import { loadEnv } from "../src/env";
import { createDeps, type Deps, type GoogleVerifier } from "../src/lib/deps";
import { unauthorized } from "../src/lib/errors";
import { issueSession } from "../src/modules/auth/session-token";

export const TEST_CLIENT_ID = "test-client.apps.googleusercontent.com";
/** The fake Google verifier accepts `google-test-token:<sub>:<email>` as an ID token. */
export const googleToken = (sub: string, email: string) => `google-test-token:${sub}:${email}`;
const fakeGoogle: GoogleVerifier = async (idToken): Promise<GoogleProfile> => {
  const [prefix, sub, email] = idToken.split(":");
  if (prefix !== "google-test-token" || !sub || !email) throw unauthorized("Bad Google token");
  return { sub, email, name: "Test User", picture: null };
};
export const JWT_SECRET = "test-secret-test-secret-test-secret-123";

/** Sunday 4 October 2026, 10:00 in Dhaka */
export const DEFAULT_NOW = zonedTimeToUtc(
  { year: 2026, month: 10, day: 4, hour: 10 },
  "Asia/Dhaka",
);

export interface TestContext {
  deps: Deps;
  app: ReturnType<typeof createApp>;
  clock: { now: number; advance(ms: number): void; set(ms: number): void };
  token: string;
  /** Signs a token for another (new or existing) Google account, for isolation tests. */
  tokenFor: (sub: string, email: string) => Promise<string>;
  request: <T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    headers?: Record<string, string>,
  ) => Promise<{ status: number; body: T }>;
}

export async function createTestContext(
  options: {
    now?: number;
    seed?: boolean;
    ai?: AiClient | null;
    env?: Record<string, string>;
  } = {},
): Promise<TestContext> {
  const clock = {
    now: options.now ?? DEFAULT_NOW,
    advance(ms: number) {
      clock.now += ms;
    },
    set(ms: number) {
      clock.now = ms;
    },
  };
  const env = loadEnv({
    DB_PATH: ":memory:",
    GOOGLE_CLIENT_IDS: TEST_CLIENT_ID,
    JWT_SECRET,
    JOBS_ENABLED: "false",
    UPLOADS_DIR: `/tmp/tick-taka-test-uploads-${process.pid}`,
    BACKUPS_DIR: `/tmp/tick-taka-test-backups-${process.pid}`,
    ...options.env,
  });
  const users = createUserRegistry(env, () => clock.now, { seed: options.seed !== false });
  const tokenFor = async (sub: string, email: string) => {
    const { user } = users.signIn({ sub, email, name: null, picture: null });
    users.data(user);
    // Real time, because the JWT's expiry is checked against the real clock.
    const { token } = await issueSession({ secret: JWT_SECRET, users, now: Date.now() }, user);
    return token;
  };
  const token = await tokenFor("test-user", "test@example.com");
  const testUser = users.list()[0]!;
  // Services called directly from a test (outside a request) act as the test user.
  const deps: Deps = createDeps(
    {
      env,
      now: () => clock.now,
      ai: options.ai ?? null,
      users,
      verifyGoogle: fakeGoogle,
    },
    () => ({ user: testUser, data: users.data(testUser) }),
  );
  const app = createApp(deps);

  const request: TestContext["request"] = async (method, path, body, headers = {}) => {
    const response = await app.request(path, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return { status: response.status, body: (text ? JSON.parse(text) : null) as never };
  };

  return { deps, app, clock, token, tokenFor, request };
}
