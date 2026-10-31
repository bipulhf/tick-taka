import { describe, expect, test } from "bun:test";
import { DAY_MS } from "@tick-taka/shared/dates";
import { FEATURES, lastUsedByFeature } from "../src/modules/admin/last-used";
import { recurringService } from "../src/modules/recurring/service";
import { createTestContext, DEFAULT_NOW, type TestContext } from "./helpers";
import type { Row } from "./money-helpers";

const lastUsed = (ctx: TestContext) =>
  lastUsedByFeature({ db: ctx.deps.db, sqlite: ctx.deps.sqlite });

describe("last used per feature", () => {
  test("a new account has used nothing, whatever was seeded for it", async () => {
    const ctx = await createTestContext();
    const result = lastUsed(ctx);
    expect(Object.keys(result).sort()).toEqual(FEATURES.map((f) => f.kind).sort());
    expect(Object.values(result).every((at) => at === null)).toBe(true);
  });

  test("the newest change the person made, per feature", async () => {
    const ctx = await createTestContext();
    ctx.clock.advance(DAY_MS);
    await ctx.request("POST", "/tasks", { title: "Plan", status: "open" });
    ctx.clock.advance(DAY_MS);
    const task = (await ctx.request<Row>("POST", "/tasks", { title: "Later", status: "open" }))
      .body;
    ctx.clock.advance(DAY_MS);
    await ctx.request("PATCH", `/tasks/${task.id}`, { status: "done" });
    const routines = (await ctx.request<Row[]>("GET", "/routines")).body;
    await ctx.request("PATCH", `/routines/${routines[0]!.id}`, { name: "Mornings" });

    const result = lastUsed(ctx);
    expect(result.tasks).toBe(DEFAULT_NOW + 3 * DAY_MS);
    // The seeded routine counts once the person changes it.
    expect(result.routines).toBe(DEFAULT_NOW + 3 * DAY_MS);
    expect(result.habits).toBeNull();
  });

  test("what the nightly jobs write doesn't count as use", async () => {
    const ctx = await createTestContext();
    ctx.clock.advance(DAY_MS);
    const goalAt = ctx.clock.now;
    // Creating a goal also makes this month's jar task, on the server's own.
    await ctx.request("POST", "/goals", {
      name: "Laptop",
      targetMinor: 1_200_000,
      deadline: "2027-03-31",
    });
    const billAt = ctx.clock.now;
    await ctx.request("POST", "/recurring", {
      kind: "bill",
      name: "Gas",
      amountMinor: 1,
      rrule: "FREQ=MONTHLY",
      nextDueAt: DEFAULT_NOW - 5 * DAY_MS,
    });
    ctx.clock.advance(DAY_MS);
    expect(recurringService(ctx.deps).markOverdue()).toBe(1);

    const result = lastUsed(ctx);
    expect(result.goals).toBe(goalAt);
    expect(result.tasks).toBeNull();
    expect(result.recurring).toBe(billAt);
  });
});
