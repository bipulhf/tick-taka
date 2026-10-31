import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { sql } from "drizzle-orm";
import { readSettings } from "../src/modules/settings/service";
import { createTestContext, type TestContext } from "./helpers";
import type { Row } from "./money-helpers";

/** Writes a raw settings row, the way a build before the Workdays merge did. */
function storeRaw(ctx: TestContext, key: string, value: unknown) {
  ctx.deps.db.run(
    sql`INSERT INTO settings (key, value, created_at, updated_at) VALUES (${key}, ${JSON.stringify(value)}, 0, 0)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
}

/** 10:00 in Dhaka on a day of October 2026 (the 2nd is a Friday, the 3rd a Saturday). */
const october = (day: number) =>
  zonedTimeToUtc({ year: 2026, month: 10, day, hour: 10 }, "Asia/Dhaka");

async function doneOn(ctx: TestContext, day: number) {
  ctx.clock.set(october(day));
  const task = await ctx.request<Row>("POST", "/tasks", { title: `Task on the ${day}th` });
  await ctx.request("PATCH", `/tasks/${task.body.id}`, { status: "done" });
}

type Progress = {
  dailyGoal: { isDayOff: boolean; streak: { current: number; freezesUsedThisMonth: number } };
};

describe("workdays and days off", () => {
  test("stored settings from before the merge keep each user's days off", async () => {
    const cases: [Record<string, unknown>, number[]][] = [
      [{}, [6, 0, 1, 2, 3, 4]],
      [{ daysOff: [5, 6] }, [0, 1, 2, 3, 4]],
      [{ workdays: [1, 2, 3, 4, 5] }, [1, 2, 3, 4, 5]],
      [{ workdays: [1, 2, 3, 4, 5], daysOff: [0, 6] }, [1, 2, 3, 4, 5]],
    ];
    for (const [stored, workdays] of cases) {
      const ctx = await createTestContext();
      for (const [key, value] of Object.entries(stored)) storeRaw(ctx, key, value);
      const res = await ctx.request<{ workdays: number[] }>("GET", "/settings");
      expect(res.status).toBe(200);
      expect(res.body.workdays).toEqual(workdays);
    }
  });

  test("choosing workdays retires the old days-off row", async () => {
    const ctx = await createTestContext();
    storeRaw(ctx, "daysOff", [4, 5]);
    expect(readSettings(ctx.deps.db).workdays).toEqual([0, 1, 2, 3, 6]);
    // Picking exactly the old default must stick, not fall back to the old days off.
    await ctx.request("PATCH", "/settings", { workdays: [0, 1, 2, 3, 4] });
    expect(readSettings(ctx.deps.db).workdays).toEqual([0, 1, 2, 3, 4]);
  });

  test("replies still carry daysOff, derived, for phones before 1.3.0", async () => {
    const ctx = await createTestContext();
    const read = await ctx.request<{ daysOff: number[] }>("GET", "/settings");
    expect(read.body.daysOff).toEqual([5]);
    const patched = await ctx.request<{ daysOff: number[] }>("PATCH", "/settings", {
      workdays: [1, 2, 3, 4, 5],
    });
    expect(patched.body.daysOff).toEqual([0, 6]);
    // An old phone's days-off change is ignored rather than refused.
    const old = await ctx.request<{ workdays: number[] }>("PATCH", "/settings", { daysOff: [3] });
    expect(old.status).toBe(200);
    expect(old.body.workdays).toEqual([1, 2, 3, 4, 5]);
  });

  test("by default Friday is a day off and Saturday is a workday", async () => {
    const ctx = await createTestContext();
    await ctx.request("PATCH", "/settings", { dailyTaskGoal: 1 });
    ctx.clock.set(october(2));
    const friday = await ctx.request<Progress>("GET", "/gamification");
    expect(friday.body.dailyGoal.isDayOff).toBe(true);
    const fridayToday = await ctx.request<{ dayFit: { isDayOff: boolean } }>("GET", "/today");
    expect(fridayToday.body.dayFit.isDayOff).toBe(true);
    ctx.clock.set(october(3));
    const saturday = await ctx.request<Progress>("GET", "/gamification");
    expect(saturday.body.dailyGoal.isDayOff).toBe(false);
    const saturdayToday = await ctx.request<{ dayFit: { isDayOff: boolean } }>("GET", "/today");
    expect(saturdayToday.body.dayFit.isDayOff).toBe(false);
  });

  test("a quiet Friday is free for the streak; a quiet Saturday costs a freeze", async () => {
    const ctx = await createTestContext();
    await ctx.request("PATCH", "/settings", { dailyTaskGoal: 1 });
    await doneOn(ctx, 1); // Thursday
    await doneOn(ctx, 4); // Sunday; nothing on Friday 2 or Saturday 3
    const res = await ctx.request<Progress>("GET", "/gamification");
    expect(res.body.dailyGoal.streak).toMatchObject({ current: 2, freezesUsedThisMonth: 1 });
  });

  test("someone who had Friday and Saturday off keeps Saturday free", async () => {
    const ctx = await createTestContext();
    storeRaw(ctx, "daysOff", [5, 6]);
    await ctx.request("PATCH", "/settings", { dailyTaskGoal: 1 });
    await doneOn(ctx, 1);
    await doneOn(ctx, 4);
    const res = await ctx.request<Progress>("GET", "/gamification");
    expect(res.body.dailyGoal.streak).toMatchObject({ current: 2, freezesUsedThisMonth: 0 });
    ctx.clock.set(october(3));
    const saturday = await ctx.request<Progress>("GET", "/gamification");
    expect(saturday.body.dailyGoal.isDayOff).toBe(true);
  });
});
