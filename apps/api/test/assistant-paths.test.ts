import { describe, expect, test } from "bun:test";
import { isPlainPath } from "../src/modules/ai/assistant/dispatch";
import { call, fields, setup } from "./assistant-helpers";

describe("assistant request paths", () => {
  test("an update id can't walk to another route", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          call("update", {
            entity: "task",
            id: "x/../../settings",
            fields: fields({ vacationMode: true }),
          }),
        ],
      },
      { content: "ok" },
    );
    await say("pause everything");
    expect(lastTool()).toEqual({ error: "id must be a record id from find" });
    const settings = await ctx.request<{ vacationMode: boolean }>("GET", "/settings");
    expect(settings.body.vacationMode).toBe(false);
  });

  test("action and delete ids must be record ids", async () => {
    const { ai, say, lastTool } = await setup();
    ai.queueChat(
      { toolCalls: [call("act", { action: "pay_bill", id: "../settings", fields: "{}" })] },
      {
        toolCalls: [
          call("delete", { entity: "task", ids: ["../../settings", "01ARZ3NDEKTSV4RRFFQ69G5FAV"] }),
        ],
      },
      { content: "ok" },
    );
    await say("pay it and delete those");
    const requests = ai.chatRequests;
    const toolOutputs = requests
      .at(-1)!
      .messages.filter((m) => m.role === "tool")
      .map((m) => JSON.parse((m as { content: string }).content) as Record<string, unknown>);
    expect(toolOutputs[0]).toEqual({ error: "id must be a record id from find" });
    expect(lastTool()).toMatchObject({
      proposed: 0,
      notFound: ["../../settings", "01ARZ3NDEKTSV4RRFFQ69G5FAV"],
    });
  });

  test("a status filter can't add query parameters", async () => {
    const { ai, say, lastTool } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          call("find", {
            entity: "task",
            query: null,
            status: "open&limit=500",
            from: null,
            to: null,
          }),
        ],
      },
      { content: "ok" },
    );
    await say("find tasks");
    expect(lastTool()).toEqual({ error: "Unknown status open&limit=500" });
  });

  test("only plain paths are dispatched", () => {
    expect(isPlainPath("/tasks/01ARZ3NDEKTSV4RRFFQ69G5FAV")).toBe(true);
    expect(isPlainPath("/tasks?status=open&q=it's%20done")).toBe(true);
    expect(isPlainPath("/tasks/x/../../settings")).toBe(false);
    expect(isPlainPath("/tasks/./x")).toBe(false);
    expect(isPlainPath("/tasks/x%2F..%2Fsettings")).toBe(false);
    expect(isPlainPath("/tasks\\..\\settings")).toBe(false);
    expect(isPlainPath("//evil.example/settings")).toBe(false);
    expect(isPlainPath("tasks")).toBe(false);
  });
});
