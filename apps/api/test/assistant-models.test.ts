import { describe, expect, test } from "bun:test";
import { aiUsage } from "../src/db/schema/system";
import { call, chat, fields, setup } from "./assistant-helpers";

const models = (ai: { chatRequests: { model: string }[] }) => ai.chatRequests.map((r) => r.model);

describe("assistant model routing", () => {
  test("a short command starts fast and stays fast for two calls, logged as used", async () => {
    const { ai, ctx, say } = await setup();
    ai.queueChat(
      { toolCalls: [call("create", { entity: "task", fields: fields({ title: "Buy rice" }) })] },
      { content: "Added.", model: "gpt-fast-actual" },
    );
    await say("add buy rice");
    expect(models(ai)).toEqual(["fast", "fast"]);
    const logged = ctx.deps.db.select().from(aiUsage).all();
    expect(logged.map((row) => row.model)).toEqual(["fake-fast", "gpt-fast-actual"]);
  });

  test("a third round moves to smart for the rest of the turn", async () => {
    const { ai, say } = await setup();
    const find = () =>
      call("find", { entity: "task", query: null, status: null, from: null, to: null });
    ai.queueChat(
      { toolCalls: [find()] },
      { toolCalls: [find()] },
      { toolCalls: [find()] },
      {
        content: "Done.",
      },
    );
    await say("tidy my tasks");
    expect(models(ai)).toEqual(["fast", "fast", "smart", "smart"]);
  });

  test("a failed tool call moves to smart at once", async () => {
    const { ai, say } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          call("create", { entity: "task", fields: fields({ title: "X", area: "Nowhere" }) }),
        ],
      },
      { content: "There's no such area." },
    );
    const res = await say("add x to nowhere");
    expect(models(ai)).toEqual(["fast", "smart"]);
    expect(res.body.memo).toContain("a step failed");
  });

  test("questions, long messages and chats with an earlier failure use smart", async () => {
    const { ai, ctx, say } = await setup();
    ai.queueChat({ content: "a" }, { content: "b" }, { content: "c" }, { content: "d" });
    await say("how much did I spend?");
    await say("কত খরচ হলো?");
    await say("x".repeat(81));
    await chat(ctx, [
      { role: "user", content: "add x" },
      { role: "assistant", content: "Sorry.", memo: "create {} ; a step failed" },
      { role: "user", content: "add y" },
    ]);
    expect(models(ai)).toEqual(["smart", "smart", "smart", "smart"]);
  });
});

describe("status lines", () => {
  test("name several records in proper plurals", async () => {
    const { plural } = await import("../src/modules/ai/assistant/agent");
    expect(plural("category")).toBe("categories");
    expect(plural("time entry")).toBe("time entries");
    expect(plural("day")).toBe("days");
    expect(plural("task")).toBe("tasks");
    expect(plural("recurring")).toBe("bills and income");
  });
});
