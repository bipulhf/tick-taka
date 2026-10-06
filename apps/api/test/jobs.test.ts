import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { sql } from "drizzle-orm";
import { runHourlyJobs, startJobs } from "../src/jobs/scheduler";
import { installCrashLogging, type LogSink, setLogSink } from "../src/lib/log";
import { createTestContext } from "./helpers";

let restore: LogSink | null = null;
function capture() {
  const lines: Record<string, unknown>[] = [];
  restore = setLogSink((_level, line) => lines.push(JSON.parse(line)));
  return lines;
}
afterEach(() => {
  if (restore) setLogSink(restore);
  restore = null;
});

/** 3:05 am in Dhaka, when the nightly backup is due. */
const BACKUP_TIME = zonedTimeToUtc(
  { year: 2026, month: 10, day: 4, hour: 3, minute: 5 },
  "Asia/Dhaka",
);

async function twoUsers() {
  const backups = mkdtempSync(join(tmpdir(), "tt-jobs-"));
  const ctx = await createTestContext({ now: BACKUP_TIME, env: { BACKUPS_DIR: backups } });
  await ctx.tokenFor("sub-b", "b@example.com");
  const [a, b] = ctx.deps.users.list();
  if (!a || !b) throw new Error("expected two users");
  return { ctx, a, b, backups };
}

describe("hourly job loop", () => {
  test("one user's database failing to open doesn't stop the others", async () => {
    const { ctx, a, b, backups } = await twoUsers();
    const lines = capture();
    const lease = ctx.deps.users.lease.bind(ctx.deps.users);
    ctx.deps.users.lease = (user) => {
      if (user.id === a.id) throw new Error("disk I/O error");
      return lease(user);
    };
    await runHourlyJobs(ctx.deps);
    expect(readdirSync(join(backups, "users", b.id))).toEqual(["app-2026-10-04.db"]);
    expect(
      lines.some((l) => l.msg === "user jobs failed" && String(l.error).includes("disk")),
    ).toBe(true);
  });

  test("a stored time zone that isn't valid uses the default instead of crashing", async () => {
    const { ctx, a, b, backups } = await twoUsers();
    ctx.deps.users
      .data(a)
      .db.run(
        sql`INSERT INTO settings (key, value, created_at, updated_at) VALUES ('timeZone', '"Not/AZone"', 0, 0)`,
      );
    await runHourlyJobs(ctx.deps);
    expect(readdirSync(join(backups, "users", a.id))).toEqual(["app-2026-10-04.db"]);
    expect(readdirSync(join(backups, "users", b.id))).toEqual(["app-2026-10-04.db"]);
  });

  test("the catch-up run logs a failure instead of rejecting unseen", async () => {
    const ctx = await createTestContext();
    const lines = capture();
    ctx.deps.users.list = () => {
      throw new Error("users.db is locked");
    };
    const stop = startJobs(ctx.deps, { catchUpMs: 0 });
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();
    expect(lines).toContainEqual(
      expect.objectContaining({ msg: "job run failed", error: "Error: users.db is locked" }),
    );
  });

  test("the catch-up run does the due jobs", async () => {
    const { ctx, a, b, backups } = await twoUsers();
    const stop = startJobs(ctx.deps, { catchUpMs: 0 });
    for (
      let i = 0;
      i < 50 && ctx.deps.users.jobRuns.lastDate(b.id, "nightly-backup") === undefined;
      i++
    )
      await new Promise((resolve) => setTimeout(resolve, 10));
    stop();
    expect(readdirSync(join(backups, "users", a.id))).toEqual(["app-2026-10-04.db"]);
    expect(ctx.deps.users.jobRuns.lastDate(b.id, "nightly-backup")).toBe("2026-10-04");
  });
});

describe("account deleted during a job run", () => {
  test("the run skips the deleted user and recreates none of their files", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-jobs-gone-"));
    const ctx = await createTestContext({
      now: BACKUP_TIME,
      env: { USER_DATA_DIR: join(dir, "users"), BACKUPS_DIR: join(dir, "backups") },
    });
    await ctx.tokenFor("sub-gone", "gone@example.com");
    const gone = ctx.deps.users.list()[1];
    if (!gone) throw new Error("expected a second user");
    ctx.deps.users.sweep();
    const run = runHourlyJobs(ctx.deps); // takes the user list, then yields
    ctx.deps.users.remove(gone);
    await run;
    expect(existsSync(join(dir, "users", `${gone.id}.db`))).toBe(false);
    expect(existsSync(join(dir, "backups", "users", gone.id))).toBe(false);
    expect(ctx.deps.users.jobRuns.lastDate(gone.id, "nightly-backup")).toBeUndefined();
  });

  test("opening a removed user's data refuses instead of creating a new file", async () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-jobs-gone-"));
    const ctx = await createTestContext({ env: { USER_DATA_DIR: join(dir, "users") } });
    await ctx.tokenFor("sub-gone", "gone@example.com");
    const gone = ctx.deps.users.list()[1];
    if (!gone) throw new Error("expected a second user");
    ctx.deps.users.remove(gone);
    expect(() => ctx.deps.users.data(gone)).toThrow();
    expect(existsSync(join(dir, "users", `${gone.id}.db`))).toBe(false);
  });
});

describe("process guard", () => {
  test("an unhandled rejection is logged, not left to kill the server", () => {
    const lines = capture();
    const handlers: ((reason: unknown) => void)[] = [];
    installCrashLogging({ on: (_event, handler) => handlers.push(handler) });
    expect(handlers).toHaveLength(1);
    handlers[0]?.(new Error("boom"));
    expect(lines).toContainEqual(
      expect.objectContaining({ level: "error", msg: "unhandled rejection", error: "Error: boom" }),
    );
  });
});
