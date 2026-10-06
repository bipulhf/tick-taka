import { describe, expect, test } from "bun:test";
import {
  HOUR_MS,
  MINUTE_MS,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { createTestContext, DEFAULT_NOW } from "./helpers";

const TZ = "Asia/Dhaka";
type Row = Record<string, unknown> & { id: string };

describe("areas and projects", () => {
  test("seeded areas, CRUD with soft delete and undo", async () => {
    const { request } = await createTestContext();
    const areas = await request<Row[]>("GET", "/areas");
    expect(areas.body.map((a) => a.name)).toEqual([
      "Job 1",
      "Job 2",
      "Teaching",
      "Research",
      "Home",
      "Personal",
    ]);
    const created = await request<Row>("POST", "/areas", {
      name: "Side gig",
      emoji: "🎸",
      color: "#FFB547",
    });
    expect(created.status).toBe(201);
    const project = await request<Row>("POST", "/projects", {
      areaId: created.body.id,
      name: "Album",
    });
    expect(project.body.status).toBe("active");
    const renamed = await request<Row>("PATCH", `/areas/${created.body.id}`, { name: "Music" });
    expect(renamed.body.name).toBe("Music");
    await request("DELETE", `/areas/${created.body.id}`);
    expect((await request("GET", `/areas/${created.body.id}`)).status).toBe(404);
    await request("POST", `/areas/${created.body.id}/restore`);
    expect((await request("GET", `/areas/${created.body.id}`)).status).toBe(200);
    const byArea = await request<Row[]>("GET", `/projects?areaId=${created.body.id}`);
    expect(byArea.body).toHaveLength(1);
  });

  test("creates are idempotent on the client id", async () => {
    const { request } = await createTestContext();
    const id = newId();
    const a = await request<Row>("POST", "/areas", { id, name: "X", emoji: "x", color: "#000000" });
    const b = await request<Row>("POST", "/areas", { id, name: "Y", emoji: "y", color: "#000000" });
    expect(b.body).toEqual(a.body);
  });

  test("last write wins on updated_at", async () => {
    const ctx = await createTestContext();
    const area = await ctx.request<Row>("POST", "/areas", {
      name: "X",
      emoji: "x",
      color: "#000000",
    });
    ctx.clock.advance(1000);
    await ctx.request("PATCH", `/areas/${area.body.id}`, { name: "Newer" });
    const stale = await ctx.request<Row>("PATCH", `/areas/${area.body.id}`, {
      name: "Older",
      updatedAt: DEFAULT_NOW + 1,
    });
    expect(stale.body.name).toBe("Newer");
  });

  test("bad references are rejected", async () => {
    const { request } = await createTestContext();
    const res = await request("POST", "/projects", { areaId: newId(), name: "Ghost" });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "invalid_reference" } });
  });
});

describe("tasks", () => {
  test("create with subtasks, one level only", async () => {
    const { request } = await createTestContext();
    const task = await request<Row & { subtasks: Row[] }>("POST", "/tasks", {
      title: "Paper",
      subtasks: ["Intro", "Method"],
    });
    expect(task.body.subtasks.map((s) => s.title)).toEqual(["Intro", "Method"]);
    const sub = task.body.subtasks[0]!;
    const nested = await request("POST", "/tasks", { title: "Deeper", parentId: sub.id });
    expect(nested.status).toBe(400);
    const list = await request<Row[]>("GET", "/tasks");
    expect(list.body).toHaveLength(1);
    const withSubs = await request<Row[]>("GET", "/tasks?includeSubtasks=true");
    expect(withSubs.body).toHaveLength(3);
  });

  test("top three holds at most three per day", async () => {
    const { request } = await createTestContext();
    for (let i = 0; i < 3; i++) {
      expect(
        (await request("POST", "/tasks", { title: `T${i}`, top3Date: "2026-10-04" })).status,
      ).toBe(201);
    }
    const fourth = await request("POST", "/tasks", { title: "T4", top3Date: "2026-10-04" });
    expect(fourth.status).toBe(409);
    const other = await request("POST", "/tasks", { title: "T5", top3Date: "2026-10-05" });
    expect(other.status).toBe(201);
  });

  test("completing a repeating task creates the next copy", async () => {
    const { request } = await createTestContext();
    const doAt = zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 10 }, TZ);
    const task = await request<Row>("POST", "/tasks", {
      title: "Lab class",
      status: "open",
      doAt,
      hasTime: true,
      reminderAt: doAt - 15 * MINUTE_MS,
      rrule: "FREQ=WEEKLY;BYDAY=SU,TU;BYHOUR=10;BYMINUTE=0",
      subtasks: ["Prepare slides"],
    });
    const done = await request<Row & { next: Row }>("PATCH", `/tasks/${task.body.id}`, {
      status: "done",
    });
    expect(done.body.doneAt).toBe(DEFAULT_NOW);
    expect(done.body.rrule).toBeNull();
    const next = done.body.next;
    expect(next.doAt).toBe(zonedTimeToUtc({ year: 2026, month: 10, day: 6, hour: 10 }, TZ));
    expect(next.reminderAt).toBe((next.doAt as number) - 15 * MINUTE_MS);
    expect(next.rrule).toBe("FREQ=WEEKLY;BYDAY=SU,TU;BYHOUR=10;BYMINUTE=0");
    const subs = await request<Row[]>("GET", `/tasks?parentId=${next.id}`);
    expect(subs.body.map((s) => s.title)).toEqual(["Prepare slides"]);
    const reopened = await request<Row>("PATCH", `/tasks/${task.body.id}`, { status: "open" });
    expect(reopened.body.doneAt).toBeNull();
  });

  test("overdue rescue moves tasks to today, tomorrow or inbox", async () => {
    const { request } = await createTestContext();
    const yesterday5pm = zonedTimeToUtc({ year: 2026, month: 10, day: 3, hour: 17 }, TZ);
    const timed = await request<Row>("POST", "/tasks", {
      title: "Call",
      status: "open",
      doAt: yesterday5pm,
      hasTime: true,
    });
    const dated = await request<Row>("POST", "/tasks", {
      title: "Read",
      status: "open",
      doAt: startOfLocalDay("2026-10-01", TZ),
    });
    const res = await request<{ moved: number; before: Row[] }>("POST", "/tasks/rescue-overdue", {
      target: "today",
    });
    expect(res.body.moved).toBe(2);
    // What each task was before, so the phone can name them and undo the move.
    expect(res.body.before.find((t) => t.id === timed.body.id)?.doAt).toBe(yesterday5pm);
    const a = await request<Row>("GET", `/tasks/${timed.body.id}`);
    expect(a.body.doAt).toBe(zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 17 }, TZ));
    const b = await request<Row>("GET", `/tasks/${dated.body.id}`);
    expect(b.body.doAt).toBe(startOfLocalDay("2026-10-04", TZ));

    await request("PATCH", `/tasks/${timed.body.id}`, { doAt: yesterday5pm });
    await request("POST", "/tasks/rescue-overdue", { target: "inbox" });
    const c = await request<Row>("GET", `/tasks/${timed.body.id}`);
    expect(c.body).toMatchObject({ status: "inbox", doAt: null });
  });

  test("move low-priority tasks to tomorrow to fit the day", async () => {
    const { request } = await createTestContext();
    const today = startOfLocalDay("2026-10-04", TZ);
    const base = { status: "open", doAt: today };
    await request("POST", "/tasks", { ...base, title: "High", priority: "high", estimateMin: 120 });
    await request("POST", "/tasks", { ...base, title: "Low A", priority: "low", estimateMin: 60 });
    await request("POST", "/tasks", { ...base, title: "Low B", priority: "low", estimateMin: 90 });
    await request("POST", "/tasks", {
      ...base,
      title: "Top",
      priority: "low",
      estimateMin: 90,
      top3Date: "2026-10-04",
    });
    const res = await request<{ moved: Row[]; before: Row[] }>("POST", "/tasks/move-low-priority", {
      date: "2026-10-04",
      minutesToFree: 100,
    });
    expect(res.body.moved.map((t) => t.title)).toEqual(["Low B", "Low A"]);
    expect(toLocalDate(res.body.moved[0]!.doAt as number, TZ)).toBe("2026-10-05");
    expect(res.body.before.map((t) => t.doAt)).toEqual([today, today]);
  });

  test("logbook search over finished tasks", async () => {
    const ctx = await createTestContext();
    const t = await ctx.request<Row>("POST", "/tasks", { title: "Fix login bug", status: "open" });
    await ctx.request("PATCH", `/tasks/${t.body.id}`, { status: "done" });
    await ctx.request("POST", "/tasks", { title: "Fix other", status: "open" });
    const logbook = await ctx.request<Row[]>(
      "GET",
      `/tasks?status=done&q=login&doneFrom=${DEFAULT_NOW - HOUR_MS}`,
    );
    expect(logbook.body.map((r) => r.title)).toEqual(["Fix login bug"]);
  });

  test("tasks can be listed by when their reminder rings, dated or not", async () => {
    const ctx = await createTestContext();
    const tomorrow = DEFAULT_NOW + 24 * HOUR_MS;
    await ctx.request("POST", "/tasks", { title: "Inbox, reminder", reminderAt: tomorrow });
    await ctx.request("POST", "/tasks", { title: "Inbox, no reminder" });
    await ctx.request("POST", "/tasks", {
      title: "Reminder in a month",
      reminderAt: DEFAULT_NOW + 30 * 24 * HOUR_MS,
    });
    const due = await ctx.request<Row[]>(
      "GET",
      `/tasks?status=inbox,open&reminderFrom=${DEFAULT_NOW}&reminderTo=${DEFAULT_NOW + 8 * 24 * HOUR_MS}`,
    );
    expect(due.body.map((r) => r.title)).toEqual(["Inbox, reminder"]);
  });

  test("delete removes subtasks too", async () => {
    const { request } = await createTestContext();
    const task = await request<Row & { subtasks: Row[] }>("POST", "/tasks", {
      title: "P",
      subtasks: ["a"],
    });
    await request("DELETE", `/tasks/${task.body.id}`);
    expect((await request("GET", `/tasks/${task.body.subtasks[0]!.id}`)).status).toBe(404);
  });
});

describe("routines", () => {
  test("seeded with steps, steps can be replaced", async () => {
    const { request } = await createTestContext();
    const list = await request<(Row & { steps: Row[] })[]>("GET", "/routines");
    expect(list.body.map((r) => r.name)).toEqual(["Morning", "Shutdown"]);
    const morning = list.body[0]!;
    const keep = morning.steps[0]!;
    const updated = await request<Row & { steps: Row[] }>("PATCH", `/routines/${morning.id}`, {
      steps: [
        { id: keep.id, title: "Water", minutes: null },
        { title: "Walk", minutes: 10 },
      ],
    });
    expect(updated.body.steps.map((s) => s.title)).toEqual(["Water", "Walk"]);
  });
});

describe("timer and time entries", () => {
  test("only one timer runs; starting another stops the first", async () => {
    const ctx = await createTestContext();
    const areas = await ctx.request<Row[]>("GET", "/areas");
    const research = areas.body.find((a) => a.name === "Research")!;
    const task = await ctx.request<Row>("POST", "/tasks", { title: "Thesis", areaId: research.id });
    const first = await ctx.request<{ started: Row }>("POST", "/timer/start", {
      taskId: task.body.id,
      source: "focus",
    });
    expect(first.body.started.areaId).toBe(research.id);
    ctx.clock.advance(25 * MINUTE_MS);
    const second = await ctx.request<{ started: Row; stopped: Row }>("POST", "/timer/start", {});
    expect(second.body.stopped.endedAt).toBe(DEFAULT_NOW + 25 * MINUTE_MS);
    ctx.clock.advance(5 * MINUTE_MS);
    const stopped = await ctx.request<Row>("POST", "/timer/stop", {});
    expect(stopped.body.endedAt).toBe(DEFAULT_NOW + 30 * MINUTE_MS);
    // A double tap on Stop answers with the entry that just stopped.
    const doubleTap = await ctx.request<Row>("POST", "/timer/stop", {});
    expect(doubleTap.status).toBe(200);
    expect(doubleTap.body.id).toBe(stopped.body.id);
    ctx.clock.advance(10 * MINUTE_MS);
    expect((await ctx.request("POST", "/timer/stop", {})).status).toBe(409);
    ctx.clock.advance(-10 * MINUTE_MS);

    const range = `from=${DEFAULT_NOW - HOUR_MS}&to=${DEFAULT_NOW + HOUR_MS}`;
    const stats = await ctx.request<{ totalMinutes: number; sessions: number; byArea: Row[] }>(
      "GET",
      `/time-entries/focus-stats?${range}`,
    );
    expect(stats.body).toMatchObject({ totalMinutes: 25, sessions: 1 });
    const byArea = await ctx.request<{ areaId: string | null; minutes: number }[]>(
      "GET",
      `/time-entries/by-area?${range}`,
    );
    expect(byArea.body.find((a) => a.areaId === research.id)?.minutes).toBe(25);
  });

  test("manual entries validate times", async () => {
    const { request } = await createTestContext();
    const bad = await request("POST", "/time-entries", {
      startedAt: DEFAULT_NOW,
      endedAt: DEFAULT_NOW - 1,
    });
    expect(bad.status).toBe(400);
    const ok = await request<Row>("POST", "/time-entries", {
      startedAt: DEFAULT_NOW - 2 * HOUR_MS,
      endedAt: DEFAULT_NOW,
      billable: true,
    });
    expect(ok.body).toMatchObject({ source: "manual", billable: true });
  });
});

describe("habits", () => {
  test("check-off, counts and streaks with freezes", async () => {
    const { request } = await createTestContext();
    const habit = await request<Row>("POST", "/habits", {
      name: "Water",
      emoji: "💧",
      targetCount: 8,
    });
    for (const date of ["2026-09-30", "2026-10-01", "2026-10-03"]) {
      await request("PUT", `/habits/${habit.body.id}/logs/${date}`, { count: 8 });
    }
    await request("PUT", `/habits/${habit.body.id}/logs/2026-10-04`, { count: 3 });
    const list = await request<
      (Row & {
        todayCount: number;
        doneToday: boolean;
        streak: { current: number; freezesUsedThisMonth: number };
      })[]
    >("GET", "/habits?date=2026-10-04");
    const water = list.body[0]!;
    expect(water.todayCount).toBe(3);
    expect(water.doneToday).toBe(false);
    expect(water.streak.current).toBe(3);
    expect(water.streak.freezesUsedThisMonth).toBe(1);
  });

  test("n times a week needs perWeek", async () => {
    const { request } = await createTestContext();
    expect(
      (await request("POST", "/habits", { name: "Gym", emoji: "🏋️", schedule: "n_per_week" }))
        .status,
    ).toBe(400);
  });

  test("vacation mode keeps streaks alive", async () => {
    const ctx = await createTestContext();
    const habit = await ctx.request<Row>("POST", "/habits", { name: "Read", emoji: "📖" });
    await ctx.request("PUT", `/habits/${habit.body.id}/logs/2026-10-04`, { count: 1 });
    await ctx.request("PATCH", "/settings", { vacationMode: true });
    ctx.clock.advance(5 * 24 * HOUR_MS);
    await ctx.request("PATCH", "/settings", { vacationMode: false });
    const settings = await ctx.request<{ vacations: { from: string; to: string | null }[] }>(
      "GET",
      "/settings",
    );
    expect(settings.body.vacations).toEqual([{ from: "2026-10-04", to: "2026-10-08" }]);
    await ctx.request("PUT", `/habits/${habit.body.id}/logs/2026-10-09`, { count: 1 });
    const list = await ctx.request<(Row & { streak: { current: number } })[]>(
      "GET",
      "/habits?date=2026-10-09",
    );
    expect(list.body[0]!.streak.current).toBe(2);
  });
});
