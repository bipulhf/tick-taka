import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import { call, fields, type Reply, setup } from "./assistant-helpers";
import type { TestContext } from "./helpers";
import { type Row, setupMoney } from "./money-helpers";

const TZ = "Asia/Dhaka";
const due = (month: number) => zonedTimeToUtc({ year: 2026, month, day: 5, hour: 9 }, TZ);

interface Draft {
  summary: string;
  method: string;
  path: string;
  body: Record<string, unknown>;
  undo?: { method: string; path: string; body?: Record<string, unknown> };
  amountMinor?: number;
  categoryId?: string;
}
type Done = Reply & { drafts: Draft[] };

/** One assistant message from the chat screen, which asks for money drafts. */
async function ask(ctx: TestContext, content: string): Promise<Done> {
  const response = await ctx.app.request("/ai/assistant", {
    method: "POST",
    headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content }], draftMoney: true }),
  });
  const text = await response.text();
  return text
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => JSON.parse(line.slice(5)) as { type: string })
    .find((event) => event.type === "done") as unknown as Done;
}

const send = (ctx: TestContext, request: Draft | NonNullable<Draft["undo"]>) =>
  ctx.request(
    request.method,
    request.path,
    request.method === "PATCH" ? { ...request.body, updatedAt: ctx.clock.now + 1 } : request.body,
  );

type BudgetLine = { categoryId: string; limitMinor: number; rollover: boolean; hasBudget: boolean };
const line = async (ctx: TestContext, categoryId: string) =>
  (await ctx.request<{ lines: BudgetLine[] }>("GET", "/budgets?month=2026-10")).body.lines.find(
    (l) => l.categoryId === categoryId,
  )!;

// QA-208: budgets and the money fields of bills, goals, events, shopping items and
// categories are drafts too.
describe("assistant budget changes are drafts", () => {
  test("set_budget proposes one line, keeps its rollover, and its undo puts the old value back", async () => {
    const { ai, ctx } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: true },
        { categoryId: fun.id, limitMinor: 200_000, rollover: false },
      ],
    });
    ai.queueChat(
      {
        toolCalls: [
          call("act", {
            action: "set_budget",
            id: null,
            fields: fields({ month: "2026-10", category: "Food", limit: 8000 }),
          }),
        ],
      },
      { content: "Your food budget is waiting for your tap." },
    );
    const done = await ask(ctx, "set my food budget to 8000");
    expect(done.actions).toHaveLength(0);
    expect(done.drafts).toHaveLength(1);
    // Nothing changed yet.
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 500_000, rollover: true });

    const draft = done.drafts[0]!;
    expect(draft).toMatchObject({
      method: "PUT",
      path: `/budgets/2026-10/${food.id}`,
      body: { limitMinor: 800_000 },
      amountMinor: 800_000,
      categoryId: food.id,
    });
    expect((await send(ctx, draft)).status).toBe(200);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 800_000, rollover: true });
    expect(await line(ctx, fun.id)).toMatchObject({ limitMinor: 200_000 });

    expect((await send(ctx, draft.undo!)).status).toBe(200);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 500_000, rollover: true });
    expect(await line(ctx, fun.id)).toMatchObject({ limitMinor: 200_000 });
  });

  test("without drafts set_budget still keeps rollover and gives an Undo", async () => {
    const { ai, ctx, say } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: food.id, limitMinor: 500_000, rollover: true }],
    });
    ai.queueChat(
      {
        toolCalls: [
          call("act", {
            action: "set_budget",
            id: null,
            fields: fields({ month: "2026-10", category: "Food", limit: 8000 }),
          }),
        ],
      },
      { content: "Done." },
    );
    const res = await say("set my food budget to 8000");
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 800_000, rollover: true });
    const action = res.body.actions[0]!;
    expect(action.undo).toMatchObject({ method: "PUT", path: `/budgets/2026-10/${food.id}` });
    await send(ctx, action.undo as NonNullable<Draft["undo"]>);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 500_000, rollover: true });
  });
});

// QA-302: a draft can wait in the chat for days; saving it, or its Undo, must touch
// only its own line, not write back the month as it was when the draft was made.
describe("an old set_budget draft", () => {
  const draftFor = async (
    ai: Awaited<ReturnType<typeof setup>>["ai"],
    ctx: TestContext,
    limit: number,
    category = "Food",
  ) => {
    ai.queueChat(
      {
        toolCalls: [
          call("act", {
            action: "set_budget",
            id: null,
            fields: fields({ month: "2026-10", category, limit }),
          }),
        ],
      },
      { content: "Waiting for your tap." },
    );
    return (await ask(ctx, `set my ${category} budget to ${limit}`)).drafts[0]!;
  };

  test("saved after other lines changed, it and its Undo leave those lines alone", async () => {
    const { ai, ctx } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    const rent = category("Rent");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: true },
        { categoryId: fun.id, limitMinor: 200_000, rollover: false },
      ],
    });
    const draft = await draftFor(ai, ctx, 8000);

    // An hour later, in the Budgets screen: Fun goes up and Rent gets a budget.
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: true },
        { categoryId: fun.id, limitMinor: 300_000, rollover: false },
        { categoryId: rent.id, limitMinor: 1_500_000, rollover: false },
      ],
    });

    expect((await send(ctx, draft)).status).toBe(200);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 800_000, rollover: true });
    expect(await line(ctx, fun.id)).toMatchObject({ limitMinor: 300_000 });
    expect(await line(ctx, rent.id)).toMatchObject({ hasBudget: true, limitMinor: 1_500_000 });

    // Fun changes again before the Undo.
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 800_000, rollover: true },
        { categoryId: fun.id, limitMinor: 350_000, rollover: false },
        { categoryId: rent.id, limitMinor: 1_500_000, rollover: false },
      ],
    });
    expect((await send(ctx, draft.undo!)).status).toBe(200);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 500_000, rollover: true });
    expect(await line(ctx, fun.id)).toMatchObject({ limitMinor: 350_000 });
    expect(await line(ctx, rent.id)).toMatchObject({ hasBudget: true, limitMinor: 1_500_000 });
  });

  test("for a new line, its Undo removes only that line", async () => {
    const { ai, ctx } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [{ categoryId: fun.id, limitMinor: 200_000, rollover: false }],
    });
    const draft = await draftFor(ai, ctx, 8000);
    await send(ctx, draft);
    expect(await line(ctx, food.id)).toMatchObject({ hasBudget: true, limitMinor: 800_000 });
    await send(ctx, draft.undo!);
    expect(await line(ctx, food.id)).toMatchObject({ hasBudget: false });
    expect(await line(ctx, fun.id)).toMatchObject({ hasBudget: true, limitMinor: 200_000 });
  });

  test("removing a line keeps the others, and its Undo brings the line back", async () => {
    const { ai, ctx } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-10",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: true },
        { categoryId: fun.id, limitMinor: 200_000, rollover: false },
      ],
    });
    const draft = await draftFor(ai, ctx, 0);
    expect(draft.summary).toContain("Remove");
    expect(draft.method).toBe("PUT");
    await send(ctx, draft);
    expect(await line(ctx, food.id)).toMatchObject({ hasBudget: false });
    expect(await line(ctx, fun.id)).toMatchObject({ hasBudget: true, limitMinor: 200_000 });
    await send(ctx, draft.undo!);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 500_000, rollover: true });
  });

  test("in a month that inherits last month's budgets, the other inherited lines stay", async () => {
    const { ai, ctx } = await setup();
    const { category } = await setupMoney(ctx);
    const food = category("Food");
    const fun = category("Fun");
    await ctx.request("PUT", "/budgets", {
      month: "2026-09",
      budgets: [
        { categoryId: food.id, limitMinor: 500_000, rollover: false },
        { categoryId: fun.id, limitMinor: 200_000, rollover: true },
      ],
    });
    const draft = await draftFor(ai, ctx, 8000);
    await send(ctx, draft);
    expect(await line(ctx, food.id)).toMatchObject({ limitMinor: 800_000 });
    expect(await line(ctx, fun.id)).toMatchObject({
      hasBudget: true,
      limitMinor: 200_000,
      rollover: true,
    });
    await send(ctx, draft.undo!);
    expect(await line(ctx, food.id)).toMatchObject({ hasBudget: true, limitMinor: 500_000 });
    expect(await line(ctx, fun.id)).toMatchObject({ hasBudget: true, limitMinor: 200_000 });
  });
});

describe("assistant edits of money fields are drafts", () => {
  test("a bill's amount, a goal's target and an event's budget wait for a tap; a name doesn't", async () => {
    const { ai, ctx } = await setup();
    const { cash } = await setupMoney(ctx);
    const bill = (
      await ctx.request<Row>("POST", "/recurring", {
        kind: "bill",
        name: "Internet",
        amountMinor: 120_000,
        accountId: cash.id,
        rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
        nextDueAt: due(10),
      })
    ).body;
    const goal = (await ctx.request<Row>("POST", "/goals", { name: "Laptop", targetMinor: 1_000 }))
      .body;
    ai.queueChat(
      {
        toolCalls: [
          call("update", { entity: "bill", id: bill.id, fields: fields({ amount: 1500 }) }),
          call("update", { entity: "goal", id: goal.id, fields: fields({ target: 90000 }) }),
          call("create", {
            entity: "event",
            fields: fields({ name: "Eid", budget: 20000, startsOn: "2026-10-10" }),
          }),
          call("update", { entity: "bill", id: bill.id, fields: fields({ name: "Fiber" }) }),
        ],
      },
      { content: "Renamed it; the money changes wait for your tap." },
    );
    const done = await ask(ctx, "internet is 1500 now, laptop goal 90000, eid budget 20000");
    expect(done.drafts.map((d) => `${d.method} ${d.path.split("/")[1]}`)).toEqual([
      "PATCH recurring",
      "PATCH goals",
      "POST events",
    ]);
    expect(done.actions).toHaveLength(1);
    const after = (await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body;
    expect(after).toMatchObject({ name: "Fiber", amountMinor: 120_000 });
    expect((await ctx.request<Row>("GET", `/goals/${goal.id}`)).body.targetMinor).toBe(1_000);
    expect((await ctx.request<Row[]>("GET", "/events")).body).toHaveLength(0);

    const billDraft = done.drafts[0]!;
    expect(billDraft.undo).toMatchObject({ body: { amountMinor: 120_000 } });
    await send(ctx, billDraft);
    expect((await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body.amountMinor).toBe(150_000);
  });
});

// QA-209: an old "Pay a bill" draft saved after the bill was paid from Today.
describe("an assistant pay draft", () => {
  test("names the due date, so saving it after the bill was paid changes nothing", async () => {
    const { ai, ctx } = await setup();
    const { cash } = await setupMoney(ctx);
    const bill = (
      await ctx.request<Row>("POST", "/recurring", {
        kind: "bill",
        name: "Internet",
        amountMinor: 120_000,
        accountId: cash.id,
        rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
        nextDueAt: due(10),
      })
    ).body;
    ai.queueChat(
      { toolCalls: [call("act", { action: "pay_bill", id: bill.id, fields: fields({}) })] },
      { content: "Tap Save to log it." },
    );
    const done = await ask(ctx, "pay my internet bill");
    const draft = done.drafts[0]!;
    expect(draft.body.dueAt).toBe(due(10));
    expect(draft.summary).toContain("Internet");

    // Paid from Today meanwhile, then the old draft is saved.
    await ctx.request("POST", `/recurring/${bill.id}/pay`, { dueAt: due(10) });
    expect((await send(ctx, draft)).status).toBe(200);
    const expenses = await ctx.request<{ items: unknown[] }>("GET", "/transactions");
    expect(expenses.body.items).toHaveLength(1);
    expect((await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body.nextDueAt).toBe(due(11));
  });

  // QA-404: a bill paid from Tiki can be undone like one paid from Today.
  test("carries an Undo through /unpay that takes the expense and the date back", async () => {
    const { ai, ctx } = await setup();
    const { cash } = await setupMoney(ctx);
    const bill = (
      await ctx.request<Row>("POST", "/recurring", {
        kind: "bill",
        name: "Internet",
        amountMinor: 120_000,
        accountId: cash.id,
        rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
        nextDueAt: due(10),
      })
    ).body;
    ai.queueChat(
      { toolCalls: [call("act", { action: "pay_bill", id: bill.id, fields: fields({}) })] },
      { content: "Tap Save to log it." },
    );
    const draft = (await ask(ctx, "pay my internet bill")).drafts[0]!;
    expect(draft.undo).toEqual({
      method: "POST",
      path: `/recurring/${bill.id}/unpay`,
      body: { transactionId: draft.body.transactionId, dueAt: due(10), skip: false },
    });
    expect((await send(ctx, draft)).status).toBe(200);
    expect((await send(ctx, draft.undo!)).status).toBe(200);
    const expenses = await ctx.request<{ items: unknown[] }>("GET", "/transactions");
    expect(expenses.body.items).toHaveLength(0);
    expect((await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body.nextDueAt).toBe(due(10));
  });
});

describe("a bill paid by the assistant directly", () => {
  test("has an Undo through /unpay", async () => {
    const { ai, ctx, say, undo } = await setup();
    const { cash } = await setupMoney(ctx);
    const bill = (
      await ctx.request<Row>("POST", "/recurring", {
        kind: "bill",
        name: "Internet",
        amountMinor: 120_000,
        accountId: cash.id,
        rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
        nextDueAt: due(10),
      })
    ).body;
    ai.queueChat(
      {
        toolCalls: [
          call("act", { action: "pay_bill", id: bill.id, fields: fields({ skip: true }) }),
        ],
      },
      { content: "Skipped." },
    );
    const { body } = await say("skip the internet bill this month");
    const action = body.actions[0]!;
    expect(action.undo).toMatchObject({
      method: "POST",
      path: `/recurring/${bill.id}/unpay`,
      body: { dueAt: due(10), skip: true },
    });
    expect((await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body.nextDueAt).toBe(due(11));
    expect((await undo(action)).status).toBe(200);
    expect((await ctx.request<Row>("GET", `/recurring/${bill.id}`)).body.nextDueAt).toBe(due(10));
  });
});
