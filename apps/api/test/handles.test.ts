import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUserRegistry } from "../src/db/user-registry";
import { loadEnv } from "../src/env";
import { runHourlyJobs } from "../src/jobs/scheduler";
import { createDeps } from "../src/lib/deps";
import { JWT_SECRET, TEST_CLIENT_ID } from "./helpers";

function fileRegistry(handles: { max?: number; idleMs?: number; minIdleMs?: number }) {
  const dir = mkdtempSync(join(tmpdir(), "tt-handles-"));
  const env = loadEnv({
    DB_PATH: join(dir, "app.db"),
    GOOGLE_CLIENT_IDS: TEST_CLIENT_ID,
    JWT_SECRET,
  });
  const clock = { now: Date.now() };
  const users = createUserRegistry(env, () => clock.now, { handles });
  const person = (n: number) =>
    users.signIn({ sub: `s${n}`, email: `u${n}@example.com`, name: null, picture: null }).user;
  return { env, clock, users, person };
}

describe("user database handles", () => {
  test("stay under the limit, closing the least recently used", () => {
    const { users, person } = fileRegistry({ max: 2, minIdleMs: 0 });
    const [a, b, c] = [person(1), person(2), person(3)];
    users.data(a);
    users.data(b);
    users.data(c);
    expect(users.openHandles).toBe(2);
    // A closed database opens again, with its data intact.
    users.data(a).sqlite.exec("update areas set name = 'Kept' where sort = 0");
    users.data(b);
    users.data(c);
    const row = users.data(a).sqlite.query("select name from areas where sort = 0").get() as {
      name: string;
    };
    expect(row.name).toBe("Kept");
  });

  test("close after sitting idle, but never while leased", () => {
    const { users, person, clock } = fileRegistry({ idleMs: 1000 });
    const [a, b] = [person(1), person(2)];
    const lease = users.lease(a);
    users.data(b);
    clock.now += 2000;
    users.sweep();
    expect(users.openHandles).toBe(1);
    expect(() => lease.data.sqlite.query("select 1").get()).not.toThrow();
    lease.release();
    clock.now += 2000;
    users.sweep();
    expect(users.openHandles).toBe(0);
  });

  test("nightly jobs close the databases they opened and yield between users", async () => {
    const { env, users, person, clock } = fileRegistry({});
    const [a] = [person(1), person(2), person(3)];
    users.data(a!);
    const deps = createDeps(
      { env, now: () => clock.now, ai: null, users, verifyGoogle: async () => ({}) as never },
      undefined,
    );
    let ranBetween = false;
    setImmediate(() => {
      ranBetween = true;
    });
    const run = runHourlyJobs(deps);
    expect(ranBetween).toBe(false);
    await run;
    expect(ranBetween).toBe(true);
    // The one that was already open stays open; the two opened for the jobs are closed.
    expect(users.openHandles).toBe(1);
  });
});
