import { describe, expect, test } from "bun:test";
import { AppError } from "../src/lib/errors";
import { type AssistantEvent, aiAssistant } from "../src/modules/ai/assistant/agent";
import { call, fields, setup } from "./assistant-helpers";

type Setup = Awaited<ReturnType<typeof setup>>;

/** Runs one turn straight through the agent, with a short deadline. */
async function turn(
  { ai, ctx }: Setup,
  content: string,
  deadlineMs: number,
): Promise<AssistantEvent[]> {
  const events: AssistantEvent[] = [];
  await aiAssistant(
    ctx.deps,
    ai,
    (path, init) => Promise.resolve(ctx.app.request(path, init)),
    `Bearer ${ctx.token}`,
    [{ role: "user", content }],
    (event) => events.push(event),
    { deadlineMs },
  );
  return events;
}

/** Makes the given model call hang until its signal aborts, like a reply that never ends. */
function hangOn(ai: Setup["ai"], n: number) {
  ai.beforeChat = (call) => {
    if (call !== n) return;
    const signal = ai.chatSignals[call - 1]!;
    return new Promise<void>((_, reject) =>
      signal.addEventListener("abort", () => reject(signal.reason)),
    );
  };
}

const task = (title: string) => call("create", { entity: "task", fields: fields({ title }) });

describe("a turn that runs too long", () => {
  test("with nothing done yet, it ends with a clean ai_error that says it took too long", async () => {
    const s = await setup();
    hangOn(s.ai, 1);
    const started = Date.now();
    const error = await turn(s, "add a task: very long title", 60).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("ai_error");
    expect((error as AppError).message).toContain("too long");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("after changes, it still ends with done: the actions, deletions and a short note", async () => {
    const s = await setup();
    const old = await s.ctx.request<{ id: string }>("POST", "/tasks", { title: "Old" });
    s.ai.queueChat({
      toolCalls: [task("Buy milk"), call("delete", { entity: "task", ids: [old.body.id] })],
    });
    hangOn(s.ai, 2);
    const events = await turn(s, "add buy milk and delete old", 60);
    const done = events.find((e) => e.type === "done");
    expect(done).toMatchObject({ type: "done", reply: expect.stringContaining("part way") });
    if (done?.type !== "done") throw new Error("no done");
    expect(done.actions.map((a) => a.summary)).toEqual(["Added task “Buy milk”"]);
    expect(done.deletions).toHaveLength(1);
    expect(s.ai.chatRequests).toHaveLength(2);
  });
});

describe("the AI failing part way", () => {
  test("a provider error after a proposed deletion still reaches the app in done", async () => {
    const s = await setup();
    const old = await s.ctx.request<{ id: string }>("POST", "/tasks", { title: "Old" });
    s.ai.queueChat({ toolCalls: [call("delete", { entity: "task", ids: [old.body.id] })] });
    s.ai.beforeChat = (n) => {
      if (n === 2) s.ai.failNext = true;
    };
    const res = await s.say("delete old");
    expect(res.body.deletions).toHaveLength(1);
    expect(res.body.reply).toContain("part way");
    expect(res.events.some((e) => e.type === "error")).toBe(false);
  });

  test("with nothing done, a provider error is the error event", async () => {
    const s = await setup();
    s.ai.failNext = true;
    const res = await s.say("hello");
    expect(res.events.at(-1)).toMatchObject({ type: "error", code: "ai_error" });
  });
});

describe("loops on one failing call", () => {
  test("the same failing call is flagged the second time and stops the tools the third", async () => {
    const s = await setup();
    const bad = () =>
      call("create", { entity: "event", fields: fields({ name: "Trip", startsOn: "nope" }) });
    s.ai.queueChat(
      { toolCalls: [bad()] },
      { toolCalls: [bad()] },
      { toolCalls: [bad()] },
      { content: "I couldn't add the trip: the date wasn't valid." },
    );
    const res = await s.say("add trip");
    expect(s.ai.chatRequests).toHaveLength(4);
    const tools = (n: number) =>
      s.ai.chatRequests[n]!.messages.filter((m) => m.role === "tool") as { content: string }[];
    expect(tools(1).at(-1)!.content).not.toContain("already failed");
    expect(tools(2).at(-1)!.content).toContain("already failed");
    // The fourth call has no tools: it can only explain.
    expect(s.ai.chatRequests[3]!.tools).toHaveLength(0);
    expect(res.body.reply).toContain("couldn't add");
    expect(res.body.memo).toContain("a step failed");
  });
});

describe("a reply cut off at the token cap", () => {
  test("its half-written tool calls don't run; the model is told to shorten", async () => {
    const s = await setup();
    s.ai.queueChat(
      {
        truncated: true,
        toolCalls: [
          {
            id: "c1",
            name: "create",
            arguments: '{"entity":"task","fields":"{\\"title\\":\\"very',
          },
        ],
      },
      { toolCalls: [task("Very long title, shortened")] },
      { content: "Added it, with a shorter title." },
    );
    const res = await s.say(`add a task: ${"very long title ".repeat(120)}`);
    const second = s.ai.chatRequests[1]!;
    expect(second.model).toBe("smart");
    const notes = second.messages.filter((m) => m.role === "system") as { content: string }[];
    expect(notes.at(-1)!.content).toContain("cut off");
    expect(notes.at(-1)!.content).toContain("300 characters");
    expect(res.body.actions.map((a) => a.summary)).toEqual([
      "Added task “Very long title, shortened”",
    ]);
  });

  test("a task title over its limit comes back with the limit in the error", async () => {
    const s = await setup();
    s.ai.queueChat({ toolCalls: [task("x".repeat(400))] }, { content: "Shortening." });
    await s.say("add a long task");
    expect(String(s.lastTool().error)).toContain("300");
  });
});
