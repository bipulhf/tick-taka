import { describe, expect, test } from "bun:test";
import { startOfLocalDay, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { FakeAi } from "./fake-ai";
import { createTestContext, DEFAULT_NOW } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";
const blankParse = {
  kind: "expense",
  title: null,
  amount: null,
  fee: null,
  accountName: null,
  toAccountName: null,
  categoryName: null,
  areaName: null,
  note: null,
  date: null,
  time: null,
  minutes: null,
  deadline: null,
  recurrence: null,
  priority: null,
  whenSlot: null,
};

describe("guardrails", () => {
  test("off switch, missing key and the server's cap each have their own code", async () => {
    const noKey = await createTestContext();
    expect((await noKey.request("POST", "/ai/parse", { text: "hi" })).body).toMatchObject({
      error: { code: "ai_unavailable" },
    });

    const ai = new FakeAi();
    const ctx = await createTestContext({ ai, env: { AI_USER_MONTHLY_CAP_MICROS: "1000" } });
    await ctx.request("PATCH", "/settings", { ai: { enabled: false, features: {} } });
    expect((await ctx.request("POST", "/ai/parse", { text: "hi" })).body).toMatchObject({
      error: { code: "ai_disabled" },
    });

    await ctx.request("PATCH", "/settings", {
      ai: { enabled: true, features: { breakdown: false } },
    });
    expect((await ctx.request("POST", "/ai/breakdown", { title: "x" })).body).toMatchObject({
      error: { code: "ai_disabled" },
    });
    ai.queueJson({ ...blankParse, kind: "task", title: "Thing" });
    expect((await ctx.request("POST", "/ai/parse", { text: "thing" })).status).toBe(200);
    // 1000 input + 200 output tokens on the fast tier ≈ 650 micro-dollars; the next call stays under 1000.
    ai.queueJson({ ...blankParse, kind: "task", title: "Thing" });
    expect((await ctx.request("POST", "/ai/parse", { text: "thing" })).status).toBe(200);
    expect((await ctx.request("POST", "/ai/parse", { text: "thing" })).body).toMatchObject({
      error: { code: "ai_cap_reached" },
    });
    const status = await ctx.request<{ capReached: boolean; monthlyCapMicros: number }>(
      "GET",
      "/ai/status",
    );
    expect(status.body).toMatchObject({ capReached: true, monthlyCapMicros: 1000 });
  });

  test("the owner is never capped", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({
      ai,
      env: { AI_USER_MONTHLY_CAP_MICROS: "1", OWNER_EMAIL: "test@example.com" },
    });
    ai.queueJson({ subtasks: [] }, { subtasks: [] });
    expect((await ctx.request("POST", "/ai/breakdown", { title: "x" })).status).toBe(200);
    expect((await ctx.request("POST", "/ai/breakdown", { title: "y" })).status).toBe(200);
    const status = await ctx.request("GET", "/ai/status");
    expect(status.body).toMatchObject({ capReached: false, monthlyCapMicros: null });
  });

  test("provider errors fall back cleanly", async () => {
    const ai = new FakeAi();
    ai.failNext = true;
    const ctx = await createTestContext({ ai });
    const res = await ctx.request("POST", "/ai/breakdown", { title: "x" });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: { code: "ai_error" } });
  });
});

describe("smart quick-add", () => {
  test("maps names to ids and never saves", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { bkash, category } = await setupMoney(ctx);
    ai.queueJson({
      ...blankParse,
      kind: "expense",
      amount: 1120,
      accountName: "bkash",
      categoryName: "Groceries",
      note: "Shwapno",
    });
    const res = await ctx.request<{ draft: Row }>("POST", "/ai/parse", {
      text: "shwapno bazar 1120 from bk",
    });
    expect(res.body.draft).toMatchObject({
      kind: "expense",
      amountMinor: 112_000,
      accountId: bkash.id,
      categoryId: category("Groceries").id,
      note: "Shwapno",
    });
    expect((await ctx.request<{ items: Row[] }>("GET", "/transactions")).body.items).toHaveLength(
      0,
    );
    expect(ai.jsonRequests[0]!.jsonSchema).toMatchObject({
      type: "object",
      additionalProperties: false,
    });
    expect(String(ai.jsonRequests[0]!.user)).toContain("bKash (mobile_wallet, BDT)");
  });

  test("tasks get dates, times and plain-words recurrence", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    ai.queueJson({
      ...blankParse,
      kind: "task",
      title: "Pay internet",
      date: "2026-10-05",
      time: "17:00",
      recurrence: "every month on the 5th",
      priority: "high",
    });
    const res = await ctx.request<{ draft: Row }>("POST", "/ai/parse", {
      text: "remind me to pay internet tmrw 5pm monthly on 5th !",
    });
    const fivePm = zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 17 }, TZ);
    expect(res.body.draft).toMatchObject({
      kind: "task",
      doAt: fivePm,
      hasTime: true,
      reminderAt: fivePm,
      rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
      priority: "high",
    });
  });

  test("AI reads a transfer between the user's own accounts", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    await setupMoney(ctx);
    ai.queueJson({
      ...blankParse,
      kind: "transfer",
      amount: 1000,
      fee: 18.5,
      accountName: "bKash",
      toAccountName: "Cash",
    });
    const res = await ctx.request<{ draft: Row }>("POST", "/ai/parse", {
      text: "cashed out 1000 from bkash, 18.50 fee",
    });
    expect(res.body.draft).toMatchObject({
      kind: "transfer",
      amountMinor: 100_000,
      feeMinor: 1_850,
    });
  });
});

describe("receipt and categorise", () => {
  test("receipt photo becomes an expense draft", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { category } = await setupMoney(ctx);
    ai.queueJson({
      merchant: "Agora",
      total: 1543.5,
      date: "2026-10-03",
      categoryName: "Groceries",
      items: [{ name: "Rice", price: 800 }],
    });
    const res = await ctx.request<{ draft: Row; items: Row[] }>("POST", "/ai/receipt", {
      imageBase64: "a".repeat(200),
      mimeType: "image/jpeg",
    });
    expect(res.body.draft).toMatchObject({
      kind: "expense",
      amountMinor: 154_350,
      note: "Agora",
      categoryId: category("Groceries").id,
    });
    expect(res.body.draft.occurredAt).toBe(startOfLocalDay("2026-10-03", TZ) + 12 * 3_600_000);
    expect(ai.jsonRequests[0]!.user).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "image" })]),
    );
  });

  test("rules and history answer before any AI call", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { cash, category } = await setupMoney(ctx);
    await ctx.request("POST", "/category-rules", {
      matchText: "Foodpanda",
      categoryId: category("Food").id,
    });
    const rule = await ctx.request<Row>("POST", "/ai/categorize", { note: "foodpanda" });
    expect(rule.body).toMatchObject({ categoryId: category("Food").id, source: "rule" });
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 100,
      note: "Pathao ride",
      categoryId: category("Transport").id,
      occurredAt: DEFAULT_NOW,
    });
    const history = await ctx.request<Row>("POST", "/ai/categorize", { note: "pathao ride" });
    expect(history.body).toMatchObject({ categoryId: category("Transport").id, source: "history" });
    expect(ai.jsonRequests).toHaveLength(0);
    ai.queueJson({ categoryName: "Health", areaName: null });
    const viaAi = await ctx.request<Row>("POST", "/ai/categorize", { note: "napa extra" });
    expect(viaAi.body).toMatchObject({ categoryId: category("Health").id, source: "ai" });
  });
});

describe("planning and coaching", () => {
  test("plan my day keeps only known tasks and valid times", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const task = await ctx.request<Row>("POST", "/tasks", {
      title: "Deep work",
      status: "open",
      top3Date: "2026-10-04",
      energy: "high",
      estimateMin: 120,
    });
    ai.queueJson({
      blocks: [
        { taskId: task.body.id, title: "Deep work", start: "09:00", end: "11:00", kind: "task" },
        { taskId: "made-up", title: "Ghost", start: "11:00", end: "11:15", kind: "break" },
        { taskId: null, title: "Bad", start: "25:00", end: "26:00", kind: "task" },
      ],
      note: "Deep work first.",
    });
    const res = await ctx.request<{ blocks: Row[]; note: string }>("POST", "/ai/plan-day", {
      date: "2026-10-04",
    });
    expect(res.body.blocks).toHaveLength(2);
    expect(res.body.blocks[0]).toMatchObject({
      taskId: task.body.id,
      startAt: zonedTimeToUtc({ year: 2026, month: 10, day: 4, hour: 9 }, TZ),
    });
    expect(res.body.blocks[1]!.taskId).toBeNull();
    expect(String(ai.jsonRequests[0]!.user)).toContain("Deep work");
  });

  test("break it down returns at most seven subtasks", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    ai.queueJson({ subtasks: ["a", "b", "c", "d", "e", "f", "g", "h"] });
    const res = await ctx.request<{ subtasks: string[] }>("POST", "/ai/breakdown", {
      title: "Write thesis chapter",
    });
    expect(res.body.subtasks).toHaveLength(7);
  });

  test("weekly coach gets computed numbers and uses the smart model", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    ai.queueJson({ observations: ["One", "Two", "Three", "Four"], suggestion: "Rest more." });
    const res = await ctx.request<{ observations: string[]; suggestion: string }>(
      "POST",
      "/ai/weekly-review",
      {},
    );
    expect(res.body.observations).toEqual(["One", "Two", "Three"]);
    expect(ai.jsonRequests[0]!.model).toBe("smart");
    expect(JSON.parse(String(ai.jsonRequests[0]!.user))).toHaveProperty("tasks_done", 0);
  });

  test("budget suggestions map names to categories and round to ৳100", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { category } = await setupMoney(ctx);
    ai.queueJson({
      budgets: [
        { categoryName: "food", limit: 11_950, reason: "Steady" },
        { categoryName: "Nope", limit: 5, reason: "x" },
      ],
    });
    const res = await ctx.request<{ budgets: unknown[] }>("POST", "/ai/budget-suggestions", {
      month: "2026-11",
    });
    expect(res.body.budgets).toEqual([
      { categoryId: category("Food").id, limitMinor: 1_200_000, reason: "Steady" },
    ]);
  });
});

describe("ask my data", () => {
  test("answers through read-only functions and masks debt names", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const { cash, category } = await setupMoney(ctx);
    await ctx.request("POST", "/transactions", {
      type: "expense",
      accountId: cash.id,
      amountMinor: 6_000,
      categoryId: category("Transport").id,
      occurredAt: DEFAULT_NOW,
    });
    await ctx.request("POST", "/debts", {
      person: "Rahim Uddin",
      direction: "owed_to_me",
      principalMinor: 50_000,
    });
    ai.queueChat(
      {
        toolCalls: [
          {
            id: "c1",
            name: "spendByCategory",
            arguments: JSON.stringify({ from: "2026-10-01", to: "2026-10-31" }),
          },
          { id: "c2", name: "debtsSummary", arguments: "{}" },
        ],
      },
      { content: "You spent ৳60 on transport in October." },
    );
    const res = await ctx.request<{ answer: string; toolsUsed: string[] }>("POST", "/ai/ask", {
      question: "How much on transport in October?",
    });
    expect(res.body).toEqual({
      answer: "You spent ৳60 on transport in October.",
      toolsUsed: ["spendByCategory", "debtsSummary"],
    });
    const toolMessages = ai.chatRequests[1]!.messages.filter((m) => m.role === "tool");
    expect(toolMessages[0]!.content).toContain('"name":"Transport","taka":60');
    expect(toolMessages[1]!.content).toContain("Person 1");
    expect(JSON.stringify(ai.chatRequests)).not.toContain("Rahim");
  });
});
