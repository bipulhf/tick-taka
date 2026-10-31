import { describe, expect, test } from "bun:test";
import type { AiToolCall } from "../src/ai/client";
import { chat } from "./assistant-helpers";
import { FakeAi } from "./fake-ai";
import { createTestContext, DEFAULT_NOW, type TestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

let callId = 0;
const tool = (name: string, args: Record<string, unknown> = {}): AiToolCall => ({
  id: `read_${++callId}`,
  name,
  arguments: JSON.stringify(args),
});
const OCTOBER = { from: "2026-10-01", to: "2026-10-31" };

/** Asks Tiki with the model calling `calls` in one round; returns each tool's reply, parsed. */
async function askWith(ctx: TestContext, ai: FakeAi, calls: AiToolCall[]) {
  ai.queueChat({ toolCalls: calls }, { content: "Here you go." });
  const res = await chat(ctx, [{ role: "user", content: "How am I doing?" }]);
  const replies = ai.chatRequests
    .at(-1)
    ?.messages.filter((m) => m.role === "tool")
    .map((m) => JSON.parse(String(m.content)) as unknown);
  return { res, replies: replies ?? [] };
}

/** A month of activity: money in two currencies, an area's time and tasks, a habit, a budget. */
async function activity(ctx: TestContext) {
  const { cash, usd, category } = await setupMoney(ctx);
  const areas = (await ctx.request<Row[]>("GET", "/areas")).body;
  const research = areas.find((a) => a.name === "Research");
  const spend = (accountId: string, amountMinor: number, extra: Record<string, unknown>) =>
    ctx.request("POST", "/transactions", {
      type: "expense",
      accountId,
      amountMinor,
      occurredAt: DEFAULT_NOW,
      ...extra,
    });
  await spend(cash.id, 25_000, { categoryId: category("Food").id, areaId: research?.id });
  await spend(cash.id, 6_000, { categoryId: category("Transport").id });
  // Dollars can't be added to taka: never in the totals.
  await spend(usd.id, 999_00, { categoryId: category("Food").id, areaId: research?.id });
  await ctx.request("POST", "/transactions", {
    type: "income",
    accountId: cash.id,
    amountMinor: 4_500_000,
    categoryId: category("Salary").id,
    occurredAt: DEFAULT_NOW,
  });
  await ctx.request("POST", "/time-entries", {
    areaId: research?.id,
    startedAt: DEFAULT_NOW - 90 * 60_000,
    endedAt: DEFAULT_NOW,
  });
  const task = await ctx.request<Row>("POST", "/tasks", { title: "Paper", areaId: research?.id });
  await ctx.request("PATCH", `/tasks/${task.body.id}`, {
    status: "done",
    updatedAt: ctx.clock.now + 1,
  });
  const habit = await ctx.request<Row>("POST", "/habits", { name: "Read", emoji: "📖" });
  await ctx.request("PUT", `/habits/${habit.body.id}/logs/2026-10-04`, { count: 1 });
  await ctx.request("PUT", "/budgets", {
    month: "2026-10",
    budgets: [{ categoryId: category("Food").id, limitMinor: 1_000_000, rollover: false }],
  });
  return { cash, usd, category };
}

// CQ-042 / QA-406: every report tool Tiki can call, with the fake AI.
describe("Tiki's read tools", () => {
  test("money tools answer in taka from default-currency rows only", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    await activity(ctx);
    const { res, replies } = await askWith(ctx, ai, [
      tool("spendByCategory", OCTOBER),
      tool("spendByArea", OCTOBER),
      tool("incomeByCategory", OCTOBER),
      tool("budgetStatus", { month: "2026-10" }),
      tool("accountBalances"),
    ]);
    expect(res.body.reply).toBe("Here you go.");
    const [byCategory, byArea, income, budget, balances] = replies;
    expect(byCategory).toEqual([
      { name: "Food", taka: 250 },
      { name: "Transport", taka: 60 },
    ]);
    expect(byArea).toEqual([
      { name: "Research", taka: 250 },
      { name: "Unassigned", taka: 60 },
    ]);
    expect(income).toEqual([{ name: "Salary", taka: 45_000 }]);
    expect(budget).toContainEqual({ category: "Food", limit: 10_000, spent: 250, left: 9_750 });
    expect(balances).toContainEqual({
      account: "Cash",
      type: "cash",
      currency: "BDT",
      balance: 5_000 - 250 - 60 + 45_000,
    });
    // Each account keeps its own currency.
    expect(balances).toContainEqual({
      account: "Payoneer",
      type: "bank",
      currency: "USD",
      balance: -999,
    });
  });

  test("time, task and habit tools", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    await activity(ctx);
    const { replies } = await askWith(ctx, ai, [
      tool("hoursByArea", OCTOBER),
      tool("tasksCompleted", OCTOBER),
      tool("habitStreaks"),
    ]);
    const [hours, done, streaks] = replies;
    expect(hours).toEqual([{ area: "Research", hours: 1.5 }]);
    expect(done).toEqual({ total: 1, byArea: [{ area: "Research", count: 1 }] });
    expect(streaks).toEqual([
      expect.objectContaining({ habit: "Read", current: 1, best: 1 }) as unknown,
    ]);
  });

  test("bad arguments and unknown tools answer the model with an error, not a 500", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { res, replies } = await askWith(ctx, ai, [
      tool("spendByCategory", { from: "October", to: "2026-10-31" }),
      tool("budgetStatus", { month: "2026-13" }),
      tool("dropTables"),
    ]);
    expect(res.status).toBe(200);
    expect(replies).toEqual([
      { error: "Dates must be YYYY-MM-DD" },
      { error: "Month must be YYYY-MM" },
      { error: "Unknown function" },
    ]);
  });

  test("debt names never reach the model", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    await ctx.request("POST", "/debts", {
      person: "Rahim Uddin",
      direction: "owed_to_me",
      principalMinor: 50_000,
    });
    const { replies } = await askWith(ctx, ai, [tool("debtsSummary")]);
    expect(replies).toEqual([[{ person: "Person 1", direction: "owed_to_me", outstanding: 500 }]]);
    expect(JSON.stringify(ai.chatRequests)).not.toContain("Rahim");
  });
});
