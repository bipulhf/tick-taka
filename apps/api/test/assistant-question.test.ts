import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { assistantQuestionFieldSchema } from "@tick-taka/shared/schemas/ai";
import { QUESTION_TOOL } from "../src/modules/ai/assistant/question";
import { call, chat, fields, setup } from "./assistant-helpers";

/** A strict-mode field: every property present, null when unused. */
const field = (value: Record<string, unknown>) => ({
  required: null,
  default: null,
  placeholder: null,
  options: null,
  ...value,
});

const newAccount = {
  question: "What should the new account be?",
  fields: [
    field({ key: "name", label: "Name", type: "text", required: true }),
    field({
      key: "type",
      label: "Type",
      type: "choice",
      required: true,
      default: "cash",
      options: [
        { value: "cash", label: "Cash" },
        { value: "bank", label: "Bank" },
        { value: "mobile_wallet", label: "Mobile wallet" },
      ],
    }),
    field({ key: "opening", label: "Opening balance", type: "amount", default: 0 }),
  ],
  submitLabel: "Add account",
};

interface Question {
  question: string;
  fields: Record<string, unknown>[];
  submitLabel?: string;
}

describe("Tiki asks with a small form", () => {
  test("ask ends the turn: done.question, no second model call, stored and returned", async () => {
    const { ai, ctx, say } = await setup();
    const threadId = newId();
    ai.queueChat({ content: "Sure.", toolCalls: [call("ask", newAccount)] });
    const res = await say("create a new account", { threadId });
    expect(ai.chatRequests).toHaveLength(1);
    const done = res.body as typeof res.body & { question?: Question };
    expect(done.reply).toBe("What should the new account be?");
    expect(done.question).toEqual({
      question: "What should the new account be?",
      fields: [
        { key: "name", label: "Name", type: "text", required: true },
        {
          key: "type",
          label: "Type",
          type: "choice",
          required: true,
          default: "cash",
          options: [
            { value: "cash", label: "Cash" },
            { value: "bank", label: "Bank" },
            { value: "mobile_wallet", label: "Mobile wallet" },
          ],
        },
        { key: "opening", label: "Opening balance", type: "amount", default: 0 },
      ],
      submitLabel: "Add account",
    });
    // Nothing new on the stream: no status or result for the question.
    expect(res.events.map((event) => event.type)).not.toContain("status");
    expect(res.body.memo).toContain("asked the user with a form");
    expect(res.body.memo).toContain("Opening balance (amount)");

    const thread = await ctx.request<{
      messages: { role: string; content: string; question: Question | null }[];
    }>("GET", `/ai/threads/${threadId}`);
    expect(thread.body.messages.map((m) => m.question)).toEqual([null, done.question!]);
    expect(thread.body.messages[1]?.content).toBe("What should the new account be?");

    // The answer comes back as plain text; history keeps the question and its fields.
    ai.queueChat({ content: "Added bKash." });
    await chat(
      ctx,
      [
        { role: "user", content: "create a new account" },
        { role: "assistant", content: done.reply, memo: done.memo },
        { role: "user", content: "Name: bKash\nType: Mobile wallet\nOpening balance: 5000 BDT" },
      ],
      ctx.token,
      { threadId },
    );
    const sent = ai.chatRequests.at(-1)!.messages;
    expect((sent.at(-2) as { content: string }).content).toContain(
      "What should the new account be?\n(Done earlier: asked the user with a form",
    );
    const again = await ctx.request<{ messages: { question: Question | null }[] }>(
      "GET",
      `/ai/threads/${threadId}`,
    );
    expect(again.body.messages.map((m) => m.question === null)).toEqual([true, false, true, true]);
  });

  test("taka and names from the model become minor units and record ids", async () => {
    const { ai, ctx, say } = await setup();
    const wallet = await ctx.request<{ id: string }>("POST", "/accounts", {
      name: "bKash",
      type: "mobile_wallet",
    });
    ai.queueChat({
      toolCalls: [
        call("ask", {
          question: "How much is the internet bill, and from which account?",
          fields: [
            field({
              key: "amount",
              label: "Amount",
              type: "amount",
              required: true,
              default: 1200,
            }),
            field({ key: "account", label: "Account", type: "account", default: "bkash" }),
            field({ key: "area", label: "Area", type: "area", default: "No such area" }),
            field({
              key: "due",
              label: "Due day",
              type: "date",
              default: "2026-10-05",
              options: [],
            }),
          ],
          submitLabel: null,
        }),
      ],
    });
    const res = await say("add my internet bill");
    const question = (res.body as { question?: Question }).question!;
    expect(question.fields).toEqual([
      { key: "amount", label: "Amount", type: "amount", required: true, default: 120000 },
      { key: "account", label: "Account", type: "account", default: wallet.body.id },
      { key: "area", label: "Area", type: "area" },
      { key: "due", label: "Due day", type: "date", default: "2026-10-05" },
    ]);
    expect(question.submitLabel).toBeUndefined();
  });

  test("invalid ask arguments are a tool error the model fixes and retries", async () => {
    const { ai, lastTool, say } = await setup();
    const bad = {
      ...newAccount,
      question: "x".repeat(161),
      fields: [field({ key: "go", label: "Go ahead", type: "choice", options: [] })],
    };
    ai.queueChat(
      { toolCalls: [call("ask", bad)] },
      {
        toolCalls: [
          call("ask", {
            question: "Move these 7 tasks to Friday?",
            fields: [
              field({
                key: "go",
                label: "Go ahead",
                type: "choice",
                required: true,
                options: [
                  { value: "yes", label: "Yes" },
                  { value: "no", label: "No" },
                ],
              }),
            ],
            submitLabel: null,
          }),
        ],
      },
    );
    const res = await say("move all of tomorrow's tasks to friday");
    expect(ai.chatRequests).toHaveLength(2);
    const error = String(lastTool().error);
    expect(error).toContain("call ask again");
    expect(error).toContain("question");
    expect(error).toContain("fields.0.options");
    expect(res.body.reply).toBe("Move these 7 tasks to Friday?");
    expect((res.body as { question?: Question }).question?.fields).toHaveLength(1);
    expect(res.body.memo).toContain("a step failed");
  });

  test("ask after a create in the same turn keeps the action; later calls don't run", async () => {
    const { ai, ctx, say } = await setup();
    ai.queueChat({
      toolCalls: [
        call("create", { entity: "task", fields: fields({ title: "Pay rent" }) }),
        call("ask", {
          question: "How much is the rent?",
          fields: [field({ key: "amount", label: "Rent", type: "amount", required: true })],
          submitLabel: null,
        }),
        call("create", { entity: "task", fields: fields({ title: "Never made" }) }),
        call("ask", { ...newAccount }),
      ],
    });
    const res = await say("remind me to pay rent and add the rent bill");
    expect(ai.chatRequests).toHaveLength(1);
    expect(res.body.reply).toBe("How much is the rent?");
    expect(res.body.actions.map((action) => action.summary)).toEqual(["Added task “Pay rent”"]);
    expect(res.body.cards.map((card) => card.title)).toEqual(["Pay rent"]);
    expect((res.body as { question?: Question }).question?.question).toBe("How much is the rent?");
    const tasks = await ctx.request<{ title: string }[]>("GET", "/tasks");
    expect(tasks.body.map((task) => task.title)).toEqual(["Pay rent"]);
  });

  test("a turn without ask has no question, and the prompt says when to ask", async () => {
    const { ai, ctx, say, system } = await setup();
    const threadId = newId();
    ai.queueChat({ content: "Hi." });
    const res = await say("hello", { threadId });
    expect("question" in res.body).toBe(false);
    expect(system()).toContain("ask tool");
    expect(system()).toContain("quick reply");
    expect(ai.chatRequests[0]!.tools.map((tool) => tool.name)).toContain("ask");
    const thread = await ctx.request<{ messages: { question: unknown }[] }>(
      "GET",
      `/ai/threads/${threadId}`,
    );
    expect(thread.body.messages.map((m) => m.question)).toEqual([null, null]);
  });

  test("the tool's JSON schema has the shared schema's fields and types", () => {
    const params = QUESTION_TOOL.parameters as {
      properties: Record<string, unknown> & {
        fields: { items: { properties: Record<string, { enum?: string[] }>; required: string[] } };
      };
      required: string[];
    };
    expect(params.required.sort()).toEqual(["fields", "question", "submitLabel"]);
    const items = params.properties.fields.items;
    const zodKeys = new Set(
      assistantQuestionFieldSchema.options.flatMap((option) => Object.keys(option.shape)),
    );
    expect(Object.keys(items.properties).sort()).toEqual([...zodKeys].sort());
    expect(items.required.sort()).toEqual([...zodKeys].sort());
    expect(items.properties.type?.enum).toEqual(
      assistantQuestionFieldSchema.options.map((option) => option.shape.type.value),
    );
  });
});
