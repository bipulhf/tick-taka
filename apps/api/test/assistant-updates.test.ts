import { describe, expect, test } from "bun:test";
import { call, fields, setup } from "./assistant-helpers";

const update = (entity: string, id: string, value: Record<string, unknown>) =>
  call("update", { entity, id, fields: fields(value) });

describe("updates are checked against the route's own schema", () => {
  test("a field the route can't change is named, not dropped quietly", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    const debt = await ctx.request<{ id: string }>("POST", "/debts", {
      person: "Rahim",
      direction: "i_owe",
      principalMinor: 50000,
    });
    ai.queueChat(
      { toolCalls: [update("debt", debt.body.id, { principal: 800 })] },
      { content: "…" },
    );
    const res = await say("change what I owe to 800");
    expect(res.body.actions).toEqual([]);
    expect(String(lastTool().error)).toContain("principal can't be changed");
    expect(String(lastTool().error)).toContain("Fields you can change: person");
  });

  test("a drafted update that Save would refuse goes back to the model; a valid one drafts", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    const account = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "Cash",
      type: "cash",
    });
    ai.queueChat(
      { toolCalls: [update("account", account.body.id, { type: "wallet" })] },
      { toolCalls: [update("account", account.body.id, { opening: 1500 })] },
      { content: "Waiting for your tap." },
    );
    const res = await say("make cash a wallet with 1500", { draftMoney: true });
    const tools = ai.chatRequests[1]!.messages.filter((m) => m.role === "tool") as {
      content: string;
    }[];
    expect(tools.at(-1)!.content).toContain("Not changed: invalid type");
    expect(lastTool()).toMatchObject({ draft: true });
    const drafts = (res.body as unknown as { drafts: { body: unknown }[] }).drafts;
    expect(drafts.map((d) => d.body)).toEqual([{ openingMinor: 150000 }]);
  });

  test("an update with no fields is refused", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    const task = await ctx.request<{ id: string }>("POST", "/tasks", { title: "Call bank" });
    ai.queueChat({ toolCalls: [update("task", task.body.id, {})] }, { content: "…" });
    await say("change it");
    expect(String(lastTool().error)).toContain("at least one field");
  });
});

describe("record ids from forms", () => {
  test("a picked id must still be one of the user's live records", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    const cash = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "Cash",
      type: "cash",
    });
    const old = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "Old bank",
      type: "bank",
    });
    await ctx.request("DELETE", `/accounts/${old.body.id}`);
    const expense = (account: string) =>
      call("create", {
        entity: "transaction",
        fields: fields({ type: "expense", amount: 50, account }),
      });
    ai.queueChat(
      { toolCalls: [expense(old.body.id)] },
      { toolCalls: [expense(cash.body.id)] },
      { content: "Added." },
    );
    const res = await say("Amount: 50 BDT\nAccount: Old bank [id x]");
    const first = ai.chatRequests[1]!.messages.filter((m) => m.role === "tool") as {
      content: string;
    }[];
    expect(first.at(-1)!.content).toContain("No account with id");
    expect(first.at(-1)!.content).toContain("Existing: Cash");
    expect(lastTool()).toMatchObject({ ok: true });
    expect(res.body.actions).toHaveLength(1);
  });
});
