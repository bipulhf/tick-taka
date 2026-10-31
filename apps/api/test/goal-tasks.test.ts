import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { runHourlyJobs } from "../src/jobs/scheduler";
import { goalService } from "../src/modules/goals/service";
import { createTestContext, type TestContext } from "./helpers";
import type { Row } from "./money-helpers";

/** 00:05 on 1 November 2026 in Dhaka, just after the month turns. */
const NOVEMBER = zonedTimeToUtc(
  { year: 2026, month: 11, day: 1, hour: 0, minute: 5 },
  "Asia/Dhaka",
);

const laptop = { name: "Laptop", targetMinor: 1_200_000, deadline: "2027-03-31" };

async function jarTasks(ctx: TestContext) {
  const { body } = await ctx.request<Row[]>("GET", "/tasks");
  return body.filter((task) => task.goalId);
}

describe("monthly goal tasks", () => {
  test("the nightly job makes this month's task once", async () => {
    const ctx = await createTestContext();
    await ctx.request("POST", "/goals", laptop);
    expect(await jarTasks(ctx)).toHaveLength(1);

    ctx.clock.set(NOVEMBER);
    await runHourlyJobs(ctx.deps);
    expect(await jarTasks(ctx)).toHaveLength(2);
    const [user] = ctx.deps.users.list();
    expect(ctx.deps.users.jobRuns.lastDate(user!.id, "goal-tasks")).toBe("2026-11-01");

    // Running it again (or an older server having made it on reading Today) adds nothing.
    expect(goalService(ctx.deps).ensureMonthlyTasks()).toBe(0);
    ctx.clock.advance(60 * 60 * 1000);
    await runHourlyJobs(ctx.deps);
    expect(await jarTasks(ctx)).toHaveLength(2);
  });

  test("a task the user deleted this month isn't made again", async () => {
    const ctx = await createTestContext();
    await ctx.request("POST", "/goals", laptop);
    const [task] = await jarTasks(ctx);
    await ctx.request("DELETE", `/tasks/${task!.id}`);
    expect(goalService(ctx.deps).ensureMonthlyTasks()).toBe(0);
  });

  test("a goal given a deadline mid-month gets its task straight away", async () => {
    const ctx = await createTestContext();
    const goal = (await ctx.request<Row>("POST", "/goals", { name: "Bike", targetMinor: 600_000 }))
      .body;
    expect(await jarTasks(ctx)).toHaveLength(0);
    await ctx.request("PATCH", `/goals/${goal.id}`, { deadline: "2027-03-31" });
    const tasks = await jarTasks(ctx);
    expect(tasks.map((task) => task.title)).toEqual(["Move ৳1,000 to the Bike jar"]);
  });
});
