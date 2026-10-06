import { describe, expect, test } from "bun:test";
import { call, fields, type Reply, setup } from "./assistant-helpers";
import { FakeAi } from "./fake-ai";
import { createTestContext } from "./helpers";

const taskTitles = async (ctx: Awaited<ReturnType<typeof setup>>["ctx"]) =>
  (await ctx.request<{ title: string }[]>("GET", "/tasks")).body.map((t) => t.title);

describe("AI failures", () => {
  test("output that doesn't fit the schema is a 502 ai_error, not a 500", async () => {
    const ai = new FakeAi().queueJson({ nonsense: true });
    const ctx = await createTestContext({ ai });
    const res = await ctx.request("POST", "/ai/parse", { text: "lunch 250" });
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: { code: "ai_error" } });
  });

  test("a timeout is a 502 ai_error that says it took too long", async () => {
    const ai = new FakeAi();
    ai.json = async () => {
      throw Object.assign(new Error("Request timed out."), { name: "APIConnectionTimeoutError" });
    };
    const ctx = await createTestContext({ ai });
    const res = await ctx.request<{ error: { code: string; message: string } }>(
      "POST",
      "/ai/breakdown",
      { title: "x" },
    );
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("ai_error");
    expect(res.body.error.message).toContain("too long");
  });
});

describe("the monthly cap", () => {
  test("is checked before every model call, not once per message", async () => {
    // One assistant round costs more than the whole cap.
    const { ai, ctx, say } = await setup({ env: { AI_USER_MONTHLY_CAP_MICROS: "1" } });
    ai.queueChat(
      { toolCalls: [call("create", { entity: "task", fields: fields({ title: "First" }) })] },
      { toolCalls: [call("create", { entity: "task", fields: fields({ title: "Second" }) })] },
      { content: "Done both." },
    );
    const res = await say("add two tasks");
    expect(ai.chatRequests).toHaveLength(1);
    expect(res.body.reply).toContain("budget ran out");
    // What was done before the cap is still reported, with its Undo.
    expect(res.body.actions).toHaveLength(1);
    expect(await taskTitles(ctx)).toContain("First");
    expect(await taskTitles(ctx)).not.toContain("Second");
    // The next message is refused before any call.
    const next = await say("one more");
    expect(next.status).toBe(429);
    expect(ai.chatRequests).toHaveLength(1);
  });
});

describe("when the phone goes away", () => {
  test("the assistant stops: no more model calls and no more writes", async () => {
    const { ai, ctx } = await setup();
    const phone = new AbortController();
    ai.beforeChat = (n) => {
      if (n === 1) phone.abort();
    };
    ai.queueChat(
      { toolCalls: [call("create", { entity: "task", fields: fields({ title: "Ghost" }) })] },
      { content: "Added it." },
    );
    const response = await ctx.app.request("/ai/assistant", {
      method: "POST",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "add ghost" }] }),
      signal: phone.signal,
    });
    await response.text().catch(() => "");
    await Bun.sleep(20);
    expect(ai.chatSignals[0]).toBeInstanceOf(AbortSignal);
    expect(ai.chatRequests).toHaveLength(1);
    expect(await taskTitles(ctx)).not.toContain("Ghost");
  });
});

describe("money drafts", () => {
  test("with draftMoney, money changes come back as drafts the phone confirms", async () => {
    const { ai, ctx } = await setup();
    await ctx.request("POST", "/accounts", { name: "Cash", type: "cash" });
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 120, account: "Cash", note: "rickshaw" }),
          }),
          call("create", { entity: "task", fields: fields({ title: "Call bank" }) }),
        ],
      },
      { content: "Logged the task; the expense is waiting for your tap." },
    );
    const response = await ctx.app.request("/ai/assistant", {
      method: "POST",
      headers: { authorization: `Bearer ${ctx.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: "rickshaw 120 and call the bank" }],
        draftMoney: true,
      }),
    });
    const text = await response.text();
    const done = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => JSON.parse(line.slice(5)) as { type: string } & Partial<Reply>)
      .find((event) => event.type === "done") as unknown as Reply & {
      drafts: {
        method: string;
        path: string;
        body: Record<string, unknown>;
        undo?: { path: string };
      }[];
    };
    // The task was added; the expense was not.
    expect(done.actions).toHaveLength(1);
    expect(await taskTitles(ctx)).toContain("Call bank");
    const before = await ctx.request<{ items: unknown[] }>("GET", "/transactions");
    expect(before.body.items).toHaveLength(0);
    // The model was told it's a draft, and the prompt says so.
    const system = ai.chatRequests[0]!.messages[0] as { content: string };
    expect(system.content).toContain("Money changes are drafts");
    const toolReply = ai.chatRequests[1]!.messages.find((m) => m.role === "tool") as {
      content: string;
    };
    expect(JSON.parse(toolReply.content)).toMatchObject({ draft: true });

    // The user taps confirm: the phone sends the draft as is.
    expect(done.drafts).toHaveLength(1);
    const draft = done.drafts[0]!;
    expect(draft).toMatchObject({ method: "POST", path: "/transactions" });
    const sent = await ctx.request(draft.method, draft.path, draft.body);
    expect(sent.status).toBe(201);
    const after = await ctx.request<{ items: { amountMinor: number }[] }>("GET", "/transactions");
    expect(after.body.items.map((t) => t.amountMinor)).toEqual([12000]);
    expect(draft.undo?.path).toBe(`/transactions/${draft.body.id}`);
  });

  test("without draftMoney, the assistant saves money changes as before", async () => {
    const { ai, ctx, say } = await setup();
    await ctx.request("POST", "/accounts", { name: "Cash", type: "cash" });
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 50, account: "Cash" }),
          }),
        ],
      },
      { content: "Done." },
    );
    const res = await say("tea 50");
    expect(res.body.actions).toHaveLength(1);
    const list = await ctx.request<{ items: unknown[] }>("GET", "/transactions");
    expect(list.body.items).toHaveLength(1);
  });
});
