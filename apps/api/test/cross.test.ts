import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DAY_MS, HOUR_MS, startOfLocalDay, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { runBackup } from "../src/jobs/backup";
import { createTestContext, DEFAULT_NOW } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";
const today = startOfLocalDay("2026-10-04", TZ);

describe("GET /today", () => {
  test("agenda, top three, timeline with bills, day fit, evening and Tiki", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: category("Food").id, limitMinor: 1_792_000 }],
    });
    const top = await ctx.request<Row>("POST", "/tasks", {
      title: "Write intro",
      status: "open",
      top3Date: "2026-10-04",
      estimateMin: 120,
      doAt: today,
    });
    await ctx.request("POST", "/tasks", {
      title: "Standup",
      status: "open",
      doAt: zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 9 }, TZ),
      hasTime: true,
      estimateMin: 240,
    });
    await ctx.request("POST", "/tasks", {
      title: "Grade quizzes",
      status: "open",
      doAt: today,
      estimateMin: 90,
    });
    await ctx.request("POST", "/tasks", {
      title: "Reply to students",
      status: "open",
      doAt: today,
      whenSlot: "evening",
    });
    await ctx.request("POST", "/tasks", { title: "Old", status: "open", doAt: today - 3 * DAY_MS });
    await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Internet",
      amountMinor: 120_000,
      accountId: cash.id,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=4",
      nextDueAt: today + 9 * HOUR_MS,
    });
    await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Rent",
      amountMinor: 2_000_000,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=10",
      nextDueAt: today + 6 * DAY_MS,
    });
    await ctx.request("POST", "/habits", { name: "Water", emoji: "💧" });

    const res = await ctx.request<{
      topThree: Row[];
      timeline: { kind: string; at: number | null; dueDate?: string }[];
      dayFit: { plannedMinutes: number; capacityMinutes: number; overflowMinutes: number };
      evening: Row[];
      upcoming: Row[];
      habits: Row[];
      safeToSpend: { dailyMinor: number };
      counts: { overdue: number; latestOverdue: string | null; inbox: number };
      tiki: { mood: string };
    }>("GET", "/today");
    expect(res.status).toBe(200);
    expect(res.body.topThree.map((t) => t.id)).toEqual([top.body.id]);
    expect(res.body.timeline.map((i) => i.kind)).toEqual(["task", "bill", "task", "task"]);
    expect(res.body.timeline.find((i) => i.kind === "bill")?.dueDate).toBe("2026-10-04");
    expect(res.body.dayFit).toEqual(
      expect.objectContaining({ plannedMinutes: 450, capacityMinutes: 360, overflowMinutes: 90 }),
    );
    expect(res.body.evening.map((t) => t.title)).toEqual(["Reply to students"]);
    expect(res.body.upcoming.map((t) => t.name)).toEqual(["Rent"]);
    expect(res.body.habits).toHaveLength(1);
    expect(res.body.safeToSpend.dailyMinor).toBe(64_000);
    expect(res.body.counts).toMatchObject({ overdue: 1, latestOverdue: "Old" });
    expect(res.body.tiki.mood).toBe("relaxed");
  });

  test("goal tasks are created when Today loads", async () => {
    const ctx = await createTestContext();
    const { deps } = ctx;
    const { goals } = await import("../src/db/schema/money");
    deps.db
      .insert(goals)
      .values({
        id: "01JA0000000000000000000001",
        name: "Bike",
        emoji: "🚲",
        targetMinor: 600_000,
        deadline: "2027-03-31",
        createdAt: 1,
        updatedAt: 1,
      })
      .run();
    await ctx.request("GET", "/today");
    const tasks = await ctx.request<Row[]>("GET", "/tasks");
    expect(tasks.body.map((t) => t.title)).toEqual(["Move ৳1,000 to the Bike jar"]);
  });

  test("an overdue bill sits at the start of today but names the due date it pays", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    const dueAt = today - 2 * DAY_MS + 9 * HOUR_MS;
    await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Internet",
      amountMinor: 120_000,
      accountId: cash.id,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=2",
      nextDueAt: dueAt,
    });
    const res = await ctx.request<{ timeline: { kind: string; at: number; dueAt?: number }[] }>(
      "GET",
      "/today",
    );
    const bill = res.body.timeline.find((i) => i.kind === "bill");
    expect(bill?.at).toBe(today);
    // "Paid" sends it, and Undo moves the bill back to it (QA-303, UX-042).
    expect(bill?.dueAt).toBe(dueAt);
  });
});

describe("insights", () => {
  test("summary by category, area, day and hourly rates", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const areas = (await ctx.request<Row[]>("GET", "/areas")).body;
    const job1 = areas.find((a) => a.name === "Job 1")!;
    await ctx.request("POST", "/transactions", {
      type: "income",
      accountId: cash.id,
      amountMinor: 4_500_000,
      areaId: job1.id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 25_000,
      categoryId: category("Food").id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("POST", "/time-entries", {
      areaId: job1.id,
      startedAt: DEFAULT_NOW - 90 * HOUR_MS,
      endedAt: DEFAULT_NOW,
    });
    const range = `from=${DEFAULT_NOW - 100 * HOUR_MS}&to=${DEFAULT_NOW + HOUR_MS}`;
    const res = await ctx.request<{
      totals: { spentMinor: number; incomeMinor: number; netMinor: number };
      byDay: { date: string; spentMinor: number }[];
      hourlyRates: { areaId: string; rateMinor: number }[];
    }>("GET", `/insights/summary?${range}`);
    expect(res.body.totals).toEqual({
      spentMinor: 25_000,
      incomeMinor: 4_500_000,
      netMinor: 4_475_000,
    });
    expect(res.body.byDay.find((d) => d.date === "2026-10-04")?.spentMinor).toBe(25_000);
    expect(res.body.hourlyRates.find((r) => r.areaId === job1.id)?.rateMinor).toBe(50_000);
    const rate = await ctx.request<{ rateMinor: number }>("GET", "/insights/hourly-rate");
    expect(rate.body.rateMinor).toBe(50_000);
    const dashboard = await ctx.request<{ area: Row; monthIncomeMinor: number }[]>(
      "GET",
      "/insights/areas",
    );
    expect(dashboard.body.find((d) => d.area.id === job1.id)?.monthIncomeMinor).toBe(4_500_000);
  });

  test("net worth over time", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 100_000,
      occurredAt: DEFAULT_NOW - 20 * DAY_MS,
    });
    const res = await ctx.request<{
      series: { month: string; netWorthMinor: number }[];
      excludedAccounts: Row[];
    }>("GET", "/insights/net-worth?months=3");
    expect(res.body.series).toEqual([
      { month: "2026-08", netWorthMinor: 1_500_000 },
      { month: "2026-09", netWorthMinor: 1_400_000 },
      { month: "2026-10", netWorthMinor: 1_400_000 },
    ]);
    expect(res.body.excludedAccounts.map((a) => a.name)).toEqual(["Payoneer"]);
  });

  test("subscription spotter flags monthly repeats", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    for (const daysAgo of [61, 31, 1]) {
      await ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor: 120_000,
        note: "Netflix",
        occurredAt: DEFAULT_NOW - daysAgo * DAY_MS,
      });
    }
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 120_000,
      note: "Random",
      occurredAt: DEFAULT_NOW - 3 * DAY_MS,
    });
    const res = await ctx.request<{ note: string; occurrences: number }[]>(
      "GET",
      "/insights/subscriptions",
    );
    expect(res.body).toEqual([expect.objectContaining({ note: "Netflix", occurrences: 3 })]);
  });

  test("weekly recap compares with the same days last week", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 30_000,
      categoryId: category("Food").id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 20_000,
      occurredAt: DEFAULT_NOW - 7 * DAY_MS,
    });
    const res = await ctx.request<{
      thisWeekMinor: number;
      lastWeekMinor: number;
      topCategory: { name: string };
      tip: string;
    }>("GET", "/insights/weekly-recap");
    expect(res.body).toMatchObject({
      thisWeekMinor: 30_000,
      lastWeekMinor: 20_000,
      topCategory: { name: "Food" },
    });
    expect(res.body.tip).toContain("Up 50%");
  });
});

describe("reviews", () => {
  test("weekly, monthly and shutdown", async () => {
    const ctx = await createTestContext();
    const { cash, category } = await setupMoney(ctx);
    const t = await ctx.request<Row>("POST", "/tasks", {
      title: "Ship feature",
      status: "open",
      priority: "high",
      doAt: today,
      estimateMin: 60,
    });
    await ctx.request("PATCH", `/tasks/${t.body.id}`, { status: "done" });
    for (const daysAgo of [1, 31, 61]) {
      await ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: cash.id,
        amountMinor: 300_000,
        categoryId: category("Food").id,
        occurredAt: DEFAULT_NOW - daysAgo * DAY_MS,
      });
    }
    const weekly = await ctx.request<{
      wins: { tasksDone: number; highlights: string[] };
      hoursVsPlan: Row[];
    }>("GET", "/reviews/weekly");
    expect(weekly.body.wins).toMatchObject({ tasksDone: 1, highlights: ["Ship feature"] });
    const monthly = await ctx.request<{
      suggestedBudgets: { categoryId: string; limitMinor: number }[];
      someday: Row[];
    }>("GET", "/reviews/monthly?month=2026-10");
    expect(monthly.body.suggestedBudgets).toEqual([
      { categoryId: category("Food").id, limitMinor: 300_000 },
    ]);
    const shutdown = await ctx.request<{ tasksDone: number; tomorrow: string }>(
      "GET",
      "/reviews/shutdown",
    );
    expect(shutdown.body).toMatchObject({ tasksDone: 1, tomorrow: "2026-10-05" });
  });
});

describe("progress", () => {
  test("daily goal and same-day logging streak", async () => {
    const ctx = await createTestContext();
    const { cash } = await setupMoney(ctx);
    for (const title of ["A", "B"]) {
      const task = await ctx.request<Row>("POST", "/tasks", { title });
      await ctx.request("PATCH", `/tasks/${task.body.id}`, { status: "done" });
    }
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 100,
      occurredAt: DEFAULT_NOW,
    });
    const res = await ctx.request<Record<string, unknown>>("GET", "/gamification");
    expect(res.body).toMatchObject({
      dailyGoal: { doneToday: 2 },
      loggingStreak: { current: 1 },
    });
    expect(res.body).not.toHaveProperty("sparks");
    expect(res.body).not.toHaveProperty("level");
  });
});

describe("sync and export", () => {
  test("changes since a timestamp include deletions", async () => {
    const ctx = await createTestContext();
    const initial = await ctx.request<{ serverTime: number; changes: Record<string, Row[]> }>(
      "GET",
      "/sync/changes?since=0",
    );
    expect(initial.body.changes.areas).toHaveLength(6);
    expect(initial.body.changes.settings?.some((r) => String(r.key).startsWith("_"))).toBe(false);
    ctx.clock.advance(1000);
    const area = initial.body.changes.areas![0]!;
    await ctx.request("DELETE", `/areas/${area.id}`);
    const delta = await ctx.request<{ changes: Record<string, Row[]> }>(
      "GET",
      `/sync/changes?since=${initial.body.serverTime}`,
    );
    expect(delta.body.changes.areas).toEqual([
      expect.objectContaining({ id: area.id, deletedAt: DEFAULT_NOW + 1000 }),
    ]);
    expect(delta.body.changes.tasks).toEqual([]);
  });

  test("sync changes cap rows per table and say when there were more", async () => {
    const ctx = await createTestContext();
    const insert = ctx.deps.sqlite.prepare(
      "insert into tasks (id, title, status, priority, created_at, updated_at) values (?, ?, 'open', 'normal', ?, ?)",
    );
    for (let i = 0; i < 5; i++)
      insert.run(`01K${String(i).padStart(23, "0")}`, `Task ${i}`, DEFAULT_NOW, DEFAULT_NOW + i);
    type Reply = { changes: Record<string, Row[]>; more: boolean };
    const capped = await ctx.request<Reply>("GET", "/sync/changes?since=0&limit=3");
    expect(capped.body.more).toBe(true);
    expect(capped.body.changes.tasks!.map((t) => t.title)).toEqual(["Task 0", "Task 1", "Task 2"]);
    const all = await ctx.request<Reply>("GET", "/sync/changes?since=0&limit=1000");
    expect(all.body.more).toBe(false);
    expect(all.body.changes.tasks).toHaveLength(5);
    expect((await ctx.request("GET", "/sync/changes?limit=5000")).status).toBe(400);
  });

  test("a sync summary counts changes per table without sending rows", async () => {
    const ctx = await createTestContext();
    const before = await ctx.request<{ serverTime: number }>("GET", "/sync/changes?summary=true");
    ctx.clock.advance(1000);
    await ctx.request("POST", "/tasks", { title: "Call the bank" });
    const summary = await ctx.request<{
      counts: Record<string, number>;
      changes: Record<string, unknown[]>;
    }>("GET", `/sync/changes?since=${before.body.serverTime}&summary=true`);
    expect(summary.body.counts.tasks).toBe(1);
    expect(summary.body.counts.transactions).toBe(0);
    expect(summary.body.changes).toEqual({});
  });

  test("sync changes reject a bad since", async () => {
    const ctx = await createTestContext();
    expect((await ctx.request("GET", "/sync/changes?since=-5")).status).toBe(400);
  });

  test("export has every table", async () => {
    const ctx = await createTestContext();
    const res = await ctx.app.request("/export", {
      headers: { authorization: `Bearer ${ctx.token}` },
    });
    expect(res.headers.get("content-disposition")).toContain("tick-taka-export-");
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = (await res.json()) as {
      app: string;
      version: number;
      exportedAt: number;
      tables: Record<string, unknown[]>;
    };
    expect(body).toMatchObject({ app: "tick-taka", version: 1, exportedAt: DEFAULT_NOW });
    expect(Object.keys(body.tables)).toHaveLength(21);
    expect(body.tables.categories!.length).toBeGreaterThan(10);
    expect(body.tables.tasks).toEqual([]);
  });

  test("export streams long tables page by page, every row once and in order", async () => {
    const ctx = await createTestContext();
    const insert = ctx.deps.sqlite.prepare(
      "insert into tasks (id, title, status, priority, created_at, updated_at) values (?, ?, 'open', 'normal', ?, ?)",
    );
    const ids = Array.from({ length: 1201 }, (_, i) => `01K${String(i).padStart(23, "0")}`);
    ctx.deps.sqlite.transaction(() => {
      for (const [i, id] of ids.entries()) insert.run(id, `Task ${i}`, DEFAULT_NOW, DEFAULT_NOW);
    })();
    const res = await ctx.app.request("/export", {
      headers: { authorization: `Bearer ${ctx.token}` },
    });
    const body = (await res.json()) as { tables: Record<string, Row[]> };
    expect(body.tables.tasks!.map((t) => t.id)).toEqual(ids);
    expect(body.tables.tasks![0]).toMatchObject({ title: "Task 0", createdAt: DEFAULT_NOW });
  });
});

describe("nightly backup", () => {
  test("VACUUM INTO writes a restorable copy and keeps 14", () => {
    const dir = mkdtempSync(join(tmpdir(), "tt-backup-"));
    for (let day = 1; day <= 15; day++)
      writeFileSync(join(dir, `app-2026-09-${String(day).padStart(2, "0")}.db`), "");
    const db = new Database(":memory:");
    db.exec("create table t (x integer); insert into t values (42);");
    const path = runBackup(db, dir, DEFAULT_NOW, TZ);
    expect(existsSync(path)).toBe(true);
    const restored = new Database(path, { readonly: true });
    expect(restored.query("select x from t").get()).toEqual({ x: 42 });
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(14);
    expect(files.at(-1)).toBe("app-2026-10-04.db");
    expect(files[0]).toBe("app-2026-09-03.db");
  });
});
