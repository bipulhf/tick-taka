import { describe, expect, test } from "bun:test";
import { call, fields, setup } from "./assistant-helpers";

describe("cards in the answer", () => {
  test("a created and a changed record become record cards with a short detail", async () => {
    const { ai, ctx, say } = await setup();
    const account = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "bKash",
      type: "mobile_wallet",
    });
    const task = await ctx.request<{ id: string }>("POST", "/tasks", {
      title: "Old title",
      status: "open",
    });
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 120, account: "bKash", note: "rickshaw" }),
          }),
          call("update", {
            entity: "task",
            id: task.body.id,
            fields: fields({ title: "New title" }),
          }),
        ],
      },
      { content: "Logged ৳120 for rickshaw and renamed the task." },
    );
    const res = await say("spent 120 on rickshaw and rename the task");
    expect(account.status).toBe(201);
    expect(res.body.cards).toEqual([
      {
        type: "record",
        kind: "transaction",
        id: expect.any(String),
        title: "rickshaw",
        subtitle: "৳120, Sun 4 Oct",
      },
      { type: "record", kind: "task", id: task.body.id, title: "New title" },
    ]);
  });

  test("found records count only when the reply names them; bills are recurring", async () => {
    const { ai, ctx, say } = await setup();
    const account = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "Cash",
      type: "cash",
    });
    for (const name of ["Internet", "Electricity"])
      await ctx.request("POST", "/recurring", {
        kind: "bill",
        name,
        amountMinor: 150_000,
        accountId: account.body.id,
        rrule: "FREQ=MONTHLY;BYMONTHDAY=5",
        nextDueAt: ctx.clock.now + 86_400_000,
      });
    ai.queueChat(
      {
        toolCalls: [
          call("find", { entity: "bill", query: null, status: null, from: null, to: null }),
        ],
      },
      { content: "Your internet bill of ৳1,500 is due tomorrow." },
    );
    const res = await say("what's due?");
    expect(res.body.cards).toEqual([
      {
        type: "record",
        kind: "recurring",
        id: expect.any(String),
        title: "Internet",
        subtitle: "৳1,500, Mon 5 Oct",
      },
    ]);
  });

  test("report tools give totals, at most three, in minor units", async () => {
    const { ai, ctx, say } = await setup();
    const account = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "Cash",
      type: "cash",
    });
    for (const amountMinor of [25_050, 10_000])
      await ctx.request("POST", "/transactions", {
        type: "expense",
        accountId: account.body.id,
        amountMinor,
        occurredAt: ctx.clock.now,
      });
    const range = { from: "2026-10-01", to: "2026-10-31" };
    ai.queueChat(
      {
        toolCalls: [
          call("spendByCategory", range),
          call("tasksCompleted", range),
          call("hoursByArea", { from: "2026-10-04", to: "2026-10-04" }),
          call("accountBalances", {}),
        ],
      },
      { content: "You spent ৳350.50 this month." },
    );
    const res = await say("how much did I spend this month?");
    expect(res.body.cards).toEqual([
      { type: "total", label: "Tasks finished, 1 Oct to 31 Oct", count: 0 },
      { type: "total", label: "Tracked, 4 Oct", minutes: 0 },
      { type: "total", label: "All accounts", amountMinor: -35_050 },
    ]);

    ai.queueChat({ toolCalls: [call("spendByCategory", range)] }, { content: "৳350.50." });
    const spent = await say("spending this month?");
    expect(spent.body.cards).toEqual([
      { type: "total", label: "Spent, 1 Oct to 31 Oct", amountMinor: 35_050 },
    ]);
  });

  test("at most six record cards; drafts and pending deletions make none", async () => {
    const { ai, ctx, say } = await setup();
    const goal = await ctx.request<{ id: string }>("POST", "/goals", {
      name: "Laptop",
      targetMinor: 1_000_000,
    });
    ai.queueChat(
      {
        toolCalls: [
          ...Array.from({ length: 8 }, (_, i) =>
            call("create", { entity: "task", fields: fields({ title: `Task ${i}` }) }),
          ),
          call("delete", { entity: "goal", ids: [goal.body.id] }),
        ],
      },
      { content: "Added 8 tasks; confirm deleting the Laptop goal." },
    );
    const res = await say("add eight tasks and delete the laptop goal");
    expect(res.body.cards).toHaveLength(6);
    expect(res.body.cards.map((card) => card.title)).toEqual(
      [0, 1, 2, 3, 4, 5].map((i) => `Task ${i}`),
    );

    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 50, note: "tea" }),
          }),
        ],
      },
      { content: "Waiting for your tap." },
    );
    const draft = await ctx.app.request("/ai/assistant", {
      method: "POST",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "tea 50" }], draftMoney: true }),
    });
    const done = (await draft.text()).split("\n").find((line) => line.includes('"type":"done"'));
    expect(JSON.parse(done!.slice(5)).cards).toEqual([]);
  });
});
