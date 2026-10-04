import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { sign } from "hono/jwt";
import type { AiClient } from "../src/ai/client";
import { createApp } from "../src/app";
import { openDatabase } from "../src/db/client";
import { seedDefaults } from "../src/db/seed";
import { loadEnv } from "../src/env";
import type { Deps } from "../src/lib/deps";

export const TEST_PASSWORD = "correct horse battery staple";
const passwordHash = btoa(await Bun.password.hash(TEST_PASSWORD, { algorithm: "bcrypt", cost: 4 }));
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
    APP_PASSWORD_HASH: passwordHash,
    JWT_SECRET,
    JOBS_ENABLED: "false",
    UPLOADS_DIR: `/tmp/tick-taka-test-uploads-${process.pid}`,
    BACKUPS_DIR: `/tmp/tick-taka-test-backups-${process.pid}`,
    ...options.env,
  });
  const { db, sqlite } = openDatabase(":memory:");
  if (options.seed !== false) seedDefaults(db, clock.now);
  const deps: Deps = { db, sqlite, env, now: () => clock.now, ai: options.ai ?? null };
  const app = createApp(deps);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const token = await sign(
    { sub: "me", iat: nowSeconds, exp: nowSeconds + 3600 },
    JWT_SECRET,
    "HS256",
  );

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

  return { deps, app, clock, token, request };
}
