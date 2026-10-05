import { describe, expect, test } from "bun:test";
import { zonedTimeToUtc } from "@tick-taka/shared/dates";
import type { AiToolCall } from "../src/ai/client";
import { FakeAi } from "./fake-ai";
import { createTestContext, type TestContext } from "./helpers";

let callId = 0;
const call = (name: string, args: Record<string, unknown>): AiToolCall => ({
  id: `call_${++callId}`,
  name,
  arguments: JSON.stringify(args),
});
const fields = (value: Record<string, unknown>) => JSON.stringify(value);

interface Reply {
  reply: string;
  actions: {
    summary: string;
    undo?: { method: string; path: string; body?: Record<string, unknown> };
  }[];
  deletions: { summary: string; path: string }[];
  memo: string;
}

type Event = { type: string; text?: string; ok?: boolean } & Partial<Reply>;

/** Posts to the streaming assistant and reads back every server-sent event. */
async function chat(
  ctx: TestContext,
  messages: { role: "user" | "assistant"; content: string; memo?: string }[],
  token = ctx.token,
) {
  const response = await ctx.app.request("/ai/assistant", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const text = await response.text();
  if (!response.headers.get("content-type")?.includes("text/event-stream"))
    return { status: response.status, events: [] as Event[], body: JSON.parse(text) as Reply };
  const events = text.split("\n\n").flatMap((block): Event[] => {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    return data ? [JSON.parse(data) as Event] : [];
  });
  const done = events.find((event) => event.type === "done") as Reply | undefined;
  return { status: response.status, events, body: done as Reply };
}

async function setup(options: { env?: Record<string, string> } = {}) {
  const ai = new FakeAi();
  const ctx = await createTestContext({ ai, ...options });
  const say = (content: string) => chat(ctx, [{ role: "user", content }]);
  const undo = (action: Reply["actions"][number]) =>
    ctx.request(
      action.undo!.method,
      action.undo!.path,
      action.undo!.body && { ...action.undo!.body, updatedAt: ctx.clock.now + 1 },
    );
  const lastTool = () => {
    const messages = ai.chatRequests.at(-1)!.messages;
    const tool = messages.filter((m) => m.role === "tool").at(-1) as { content: string };
    return JSON.parse(tool.content) as Record<string, unknown>;
  };
  return { ai, ctx, say, undo, lastTool };
}

describe("chat assistant", () => {
  test("creates a task from local date text and can undo it", async () => {
    const { ai, ctx, say, undo } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "task",
            fields: fields({ title: "Call bank", doAt: "2026-10-05 17:00", area: "home" }),
          }),
        ],
      },
      { content: "Added “Call bank” for tomorrow at 5 pm." },
    );
    const res = await say("remind me to call the bank tomorrow 5pm");
    expect(res.status).toBe(200);
    expect(res.body.reply).toContain("Call bank");
    expect(res.body.actions[0]?.summary).toBe("Added task “Call bank”");
    expect(res.body.memo).toContain("id ");

    const tasks = await ctx.request<
      { id: string; doAt: number; hasTime: boolean; status: string; areaId: string }[]
    >("GET", "/tasks?status=open");
    const task = tasks.body.find((t) => t.id && t.doAt);
    expect(task?.doAt).toBe(
      zonedTimeToUtc({ year: 2026, month: 10, day: 5, hour: 17 }, "Asia/Dhaka"),
    );
    expect(task?.hasTime).toBe(true);
    expect(task?.areaId).toBeString();

    await undo(res.body.actions[0]!);
    expect((await ctx.request<unknown[]>("GET", "/tasks?status=open")).body).toHaveLength(0);
  });

  test("updates an expense in taka by account name, with an undo that restores the old amount", async () => {
    const { ai, ctx, say, undo } = await setup();
    const account = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "bKash",
      type: "mobile_wallet",
    });
    const tx = await ctx.request<{ id: string }>("POST", "/transactions", {
      type: "expense",
      accountId: account.body.id,
      amountMinor: 25_000,
      note: "lunch",
      occurredAt: ctx.clock.now,
    });
    ai.queueChat(
      {
        toolCalls: [
          call("update", {
            entity: "transaction",
            id: tx.body.id,
            fields: fields({ amount: 300 }),
          }),
        ],
      },
      { content: "Lunch is now ৳300." },
    );
    const res = await say("lunch was actually 300");
    expect(res.body.actions[0]?.summary).toBe("Updated transaction “lunch”");
    expect(
      (await ctx.request<{ amountMinor: number }>("GET", `/transactions/${tx.body.id}`)).body
        .amountMinor,
    ).toBe(30_000);

    await undo(res.body.actions[0]!);
    expect(
      (await ctx.request<{ amountMinor: number }>("GET", `/transactions/${tx.body.id}`)).body
        .amountMinor,
    ).toBe(25_000);
  });

  test("only asks to delete; the user's own DELETE does it, and restore undoes it", async () => {
    const { ai, ctx, say } = await setup();
    const goal = await ctx.request<{ id: string }>("POST", "/goals", {
      name: "Laptop",
      targetMinor: 1_000_000,
    });
    ai.queueChat(
      { toolCalls: [call("delete", { entity: "goal", ids: [goal.body.id] })] },
      { content: "Tap Delete to remove the Laptop goal." },
    );
    const res = await say("delete the laptop goal");
    expect(res.body.actions).toHaveLength(0);
    expect(res.body.deletions).toEqual([
      { summary: "Goal “Laptop”", path: `/goals/${goal.body.id}` },
    ]);
    expect(res.body.memo).toContain(`asked to delete /goals/${goal.body.id}`);
    expect((await ctx.request<unknown[]>("GET", "/goals")).body).toHaveLength(1);

    // What the phone sends when the user taps Delete, then Undo.
    const path = res.body.deletions[0]!.path;
    expect((await ctx.request("DELETE", path)).status).toBe(200);
    expect((await ctx.request<unknown[]>("GET", "/goals")).body).toHaveLength(0);
    await ctx.request("POST", `${path}/restore`);
    expect((await ctx.request<unknown[]>("GET", "/goals")).body).toHaveLength(1);
  });

  test("asks for many deletions in one call, including routes without GET /:id", async () => {
    const { ai, ctx, say } = await setup();
    const routines = await ctx.request<{ id: string; name: string }[]>("GET", "/routines");
    const habit = await ctx.request<{ id: string }>("POST", "/habits", {
      name: "Water",
      emoji: "💧",
      targetCount: 8,
    });
    ai.queueChat(
      {
        toolCalls: [
          call("delete", { entity: "routine", ids: routines.body.map((r) => r.id) }),
          call("delete", { entity: "habit", ids: [habit.body.id] }),
        ],
      },
      { content: "Confirm to delete them." },
    );
    const res = await say("delete all my routines and the water habit");
    expect(res.body.deletions.map((d) => d.summary).sort()).toEqual(
      [...routines.body.map((r) => `Routine “${r.name}”`), "Habit “Water”"].sort(),
    );
    expect((await ctx.request<unknown[]>("GET", "/routines")).body).toHaveLength(
      routines.body.length,
    );
  });

  test("can't reach another user's records, even with their ids", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    const other = await ctx.tokenFor("other-user", "other@example.com");
    const theirs = await ctx.request<{ id: string }>(
      "POST",
      "/goals",
      { name: "Their goal", targetMinor: 5_000 },
      { authorization: `Bearer ${other}` },
    );
    ai.queueChat(
      { toolCalls: [call("delete", { entity: "goal", ids: [theirs.body.id] })] },
      { content: "I couldn't find that goal." },
    );
    const res = await say("delete goal");
    expect(res.body.deletions).toHaveLength(0);
    expect(lastTool().notFound).toEqual([theirs.body.id]);
    expect((await ctx.request("DELETE", `/goals/${theirs.body.id}`)).status).toBe(404);
    const still = await ctx.request<unknown[]>("GET", "/goals", undefined, {
      authorization: `Bearer ${other}`,
    });
    expect(still.body).toHaveLength(1);
  });

  test("streams each step, each change and the reply text as it goes", async () => {
    const { ai, ctx } = await setup();
    ai.queueChat(
      {
        content: "Let me add that.",
        toolCalls: [call("create", { entity: "task", fields: fields({ title: "Pay rent" }) })],
      },
      { content: "Added “Pay rent” to your inbox." },
    );
    const res = await chat(ctx, [{ role: "user", content: "add pay rent" }]);
    const types = res.events.map((e) => e.type);
    expect(types.indexOf("reset")).toBeLessThan(types.indexOf("status"));
    expect(res.events.find((e) => e.type === "status")?.text).toBe("Adding task “Pay rent”");
    expect(res.events.find((e) => e.type === "result")).toEqual({ type: "result", ok: true });
    expect(types.indexOf("action")).toBeLessThan(types.indexOf("done"));
    const afterReset = res.events.slice(types.indexOf("reset"));
    const streamed = afterReset
      .filter((e) => e.type === "delta")
      .map((e) => e.text)
      .join("");
    expect(streamed).toBe(res.body.reply);
  });

  test("when out of steps, wraps up in words instead of giving up", async () => {
    const { ai, say } = await setup();
    const find = () =>
      call("find", { entity: "task", query: null, status: null, from: null, to: null });
    ai.queueChat(...Array.from({ length: 12 }, () => ({ toolCalls: [find()] })), {
      content: "I looked through your tasks; ask me again to finish.",
    });
    const res = await say("do a lot");
    expect(res.body.reply).toBe("I looked through your tasks; ask me again to finish.");
    expect(ai.chatRequests.at(-1)!.tools).toHaveLength(0);
  });

  test("an unknown name goes back to the model with the real options and writes nothing", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    await ctx.request("POST", "/accounts", { name: "Cash", type: "cash" });
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "transaction",
            fields: fields({ type: "expense", amount: 50, account: "City Bank" }),
          }),
        ],
      },
      { content: "Which account?" },
    );
    const res = await say("spent 50 from city bank");
    expect(res.body.actions).toHaveLength(0);
    expect(String(lastTool().error)).toContain("Existing: Cash");
  });

  test("validation errors from the route reach the model", async () => {
    const { ai, say, lastTool } = await setup();
    ai.queueChat(
      {
        toolCalls: [
          call("create", {
            entity: "event",
            fields: fields({ name: "Trip", startsOn: "2026-10-10", endsOn: "2026-10-01" }),
          }),
        ],
      },
      { content: "Fixing the dates." },
    );
    const res = await say("trip from the 10th to the 1st");
    expect(res.body.actions).toHaveLength(0);
    expect(res.events.find((e) => e.type === "result")).toEqual({ type: "result", ok: false });
    expect(String(lastTool().error)).toContain("End date");
  });

  test("logs a habit one more time and undoes back to the old count", async () => {
    const { ai, ctx, say, undo } = await setup();
    const habit = await ctx.request<{ id: string }>("POST", "/habits", {
      name: "Water",
      emoji: "💧",
      targetCount: 8,
    });
    ai.queueChat(
      { toolCalls: [call("act", { action: "log_habit", id: habit.body.id, fields: "{}" })] },
      { content: "Logged." },
    );
    const res = await say("drank a glass of water");
    expect(res.body.actions[0]?.summary).toBe("Logged “Water” (1/8)");
    const today = await ctx.request<{ todayCount: number }[]>("GET", "/habits");
    expect(today.body[0]?.todayCount).toBe(1);
    await undo(res.body.actions[0]!);
    expect(
      (await ctx.request<{ todayCount: number }[]>("GET", "/habits")).body[0]?.todayCount,
    ).toBe(0);
  });

  test("find hides debt names unless the user typed them", async () => {
    const { ai, ctx, say, lastTool } = await setup();
    await ctx.request("POST", "/debts", {
      person: "Rahim",
      direction: "owed_to_me",
      principalMinor: 50_000,
    });
    await ctx.request("POST", "/debts", {
      person: "Karim",
      direction: "i_owe",
      principalMinor: 20_000,
    });
    ai.queueChat(
      {
        toolCalls: [
          call("find", { entity: "debt", query: null, status: null, from: null, to: null }),
        ],
      },
      { content: "ok" },
    );
    await say("who owes me");
    const items = lastTool().items as { person: string; principal: number }[];
    expect(items.map((i) => i.person).sort()).toEqual(["Person 1", "Person 2"]);
    expect(items.some((i) => i.principal === 500)).toBe(true);

    ai.queueChat(
      {
        toolCalls: [
          call("find", { entity: "debt", query: "rahim", status: null, from: null, to: null }),
        ],
      },
      { content: "ok" },
    );
    await say("how much does rahim owe");
    expect((lastTool().items as { person: string }[])[0]?.person).toBe("Rahim");
  });

  test("passes earlier actions back as context and respects the feature switch", async () => {
    const { ai, ctx } = await setup();
    ai.queueChat({ content: "Moved it." });
    await chat(ctx, [
      { role: "user", content: "add call bank" },
      { role: "assistant", content: "Added it.", memo: "create task -> id 01ABC" },
      { role: "user", content: "move it to friday" },
    ]);
    const sent = ai.chatRequests.at(-1)!.messages;
    expect(sent.some((m) => m.role === "assistant" && String(m.content).includes("01ABC"))).toBe(
      true,
    );
    expect(String(sent[0]!.content)).toContain("Today is 2026-10-04");

    await ctx.request("PATCH", "/settings", {
      ai: { enabled: true, monthlyCapMicros: 2_000_000, features: { assistant: false } },
    });
    const off = await ctx.request<{ error: { code: string } }>("POST", "/ai/assistant", {
      messages: [{ role: "user", content: "hi" }],
    });
    expect(off.body.error.code).toBe("ai_disabled");
  });
});

describe("voice", () => {
  test("transcribes a voice note with a Bangla hint and logs the cost", async () => {
    const ai = new FakeAi();
    ai.transcript = "দুপুরের খাবার ২৫০ টাকা";
    const ctx = await createTestContext({ ai });
    const res = await ctx.request<{ text: string }>("POST", "/ai/transcribe", {
      audio: "A".repeat(200),
      mimeType: "audio/mp4",
    });
    expect(res.status).toBe(200);
    expect(res.body.text).toBe("দুপুরের খাবার ২৫০ টাকা");
    expect(ai.transcribeRequests[0]?.prompt).toContain("টাকা");
    const status = await ctx.request<{ monthSpendMicros: number }>("GET", "/ai/status");
    expect(status.body.monthSpendMicros).toBeGreaterThan(0);
  });

  test("treats an echo of the hint (silence) as nothing heard", async () => {
    const ai = new FakeAi();
    const ctx = await createTestContext({ ai });
    const body = { audio: "A".repeat(200), mimeType: "audio/mp4" };
    ai.transcript = "আজকে bKash থেকে ২৫০ টাকা খরচ। Call the bank tomorrow at 5pm.";
    expect((await ctx.request<{ text: string }>("POST", "/ai/transcribe", body)).body.text).toBe(
      "",
    );
    ai.transcript = " . ";
    expect((await ctx.request<{ text: string }>("POST", "/ai/transcribe", body)).body.text).toBe(
      "",
    );
  });

  test("rejects audio types it can't read", async () => {
    const ctx = await createTestContext({ ai: new FakeAi() });
    const res = await ctx.request("POST", "/ai/transcribe", {
      audio: "A".repeat(200),
      mimeType: "video/mp4",
    });
    expect(res.status).toBe(400);
  });
});
