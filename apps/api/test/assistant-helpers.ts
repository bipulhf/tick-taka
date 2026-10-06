import type { AiToolCall } from "../src/ai/client";
import { FakeAi } from "./fake-ai";
import { createTestContext, type TestContext } from "./helpers";

/** Shared by the assistant tests: scripted tool calls and a reader for the event stream. */
let callId = 0;
export const call = (name: string, args: Record<string, unknown>): AiToolCall => ({
  id: `call_${++callId}`,
  name,
  arguments: JSON.stringify(args),
});
export const fields = (value: Record<string, unknown>) => JSON.stringify(value);

export interface Reply {
  reply: string;
  actions: {
    summary: string;
    undo?: { method: string; path: string; body?: Record<string, unknown> };
  }[];
  deletions: { summary: string; path: string }[];
  memo: string;
}

export type Event = { type: string; text?: string; ok?: boolean } & Partial<Reply>;

/** Posts to the streaming assistant and reads back every server-sent event. */
export async function chat(
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

export async function setup(options: { env?: Record<string, string> } = {}) {
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
