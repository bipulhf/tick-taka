import { describe, expect, test } from "bun:test";
import { newId } from "@tick-taka/shared/ids";
import { sql } from "drizzle-orm";
import { threadTitle } from "../src/modules/ai/assistant/threads";
import { call, chat, fields, setup } from "./assistant-helpers";

interface Summary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  deletedAt: number | null;
}

interface Thread extends Summary {
  messages: {
    id: string;
    role: string;
    content: string;
    memo: string | null;
    cards: { title?: string }[];
    actions: { summary: string }[];
    rating: string | null;
  }[];
}

const as = (token: string) => ({ authorization: `Bearer ${token}` });

describe("chats kept on the server", () => {
  test("a card for a kind of record the app no longer has is left out", async () => {
    const { ai, ctx, say } = await setup();
    const threadId = newId();
    ai.queueChat({ content: "Hi." });
    await say("hello", { threadId });
    const stored = [
      { type: "record", kind: "shopping_item", id: newId(), title: "Rice" },
      { type: "record", kind: "task", id: newId(), title: "Call bank" },
    ];
    ctx.deps.db.run(
      sql`UPDATE assistant_messages SET cards = ${JSON.stringify(stored)} WHERE role = 'assistant'`,
    );
    const thread = await ctx.request<Thread>("GET", `/ai/threads/${threadId}`);
    expect(thread.body.messages[1]?.cards.map((card) => card.title)).toEqual(["Call bank"]);
  });

  test("a turn with a threadId stores the message and the reply with what it did", async () => {
    const { ai, ctx, say } = await setup();
    const threadId = newId();
    ai.queueChat(
      { toolCalls: [call("create", { entity: "task", fields: fields({ title: "Call bank" }) })] },
      { content: "Added “Call bank”." },
    );
    const res = await say("remind me to call the bank", { threadId });
    expect(res.body.threadId).toBe(threadId);
    expect(res.body.messageId).toBeString();

    const thread = await ctx.request<Thread>("GET", `/ai/threads/${threadId}`);
    expect(thread.body.title).toBe("remind me to call the bank");
    expect(thread.body.messages.map((m) => [m.role, m.content])).toEqual([
      ["user", "remind me to call the bank"],
      ["assistant", "Added “Call bank”."],
    ]);
    const reply = thread.body.messages[1]!;
    expect(reply.id).toBe(res.body.messageId!);
    expect(reply.memo).toContain("-> id");
    expect(reply.cards.map((card) => card.title)).toEqual(["Call bank"]);
    expect(reply.actions).toEqual([{ summary: "Added task “Call bank”" }]);
    expect(reply.rating).toBeNull();

    // The next turn in the same chat adds to it; the title stays.
    ai.queueChat({ content: "You're welcome." });
    const next = await chat(
      ctx,
      [
        { role: "user", content: "remind me to call the bank" },
        { role: "assistant", content: "Added “Call bank”." },
        { role: "user", content: "thanks" },
      ],
      ctx.token,
      { threadId },
    );
    expect(next.body.threadId).toBe(threadId);
    const list = await ctx.request<Summary[]>("GET", "/ai/threads");
    expect(list.body).toEqual([
      {
        id: threadId,
        title: "remind me to call the bank",
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
        deletedAt: null,
        messageCount: 4,
      },
    ]);
  });

  test("without a threadId nothing is stored and done has no ids", async () => {
    const { ai, ctx, say } = await setup();
    ai.queueChat({ content: "Hi." });
    const res = await say("hello");
    expect(res.body.threadId).toBeUndefined();
    expect(res.body.messageId).toBeUndefined();
    expect((await ctx.request<Summary[]>("GET", "/ai/threads")).body).toEqual([]);
  });

  test("lists newest first; rename, soft delete and restore", async () => {
    const { ai, ctx, say } = await setup();
    const first = newId();
    const second = newId();
    ai.queueChat({ content: "a" }, { content: "b" });
    await say("first chat", { threadId: first });
    ctx.clock.advance(1000);
    await say("second chat", { threadId: second });
    const ids = async () =>
      (await ctx.request<Summary[]>("GET", "/ai/threads")).body.map((t) => t.id);
    expect(await ids()).toEqual([second, first]);

    ctx.clock.advance(1000);
    const renamed = await ctx.request<Thread>("PATCH", `/ai/threads/${first}`, {
      title: "Groceries",
    });
    expect(renamed.body.title).toBe("Groceries");
    expect((await ctx.request("PATCH", `/ai/threads/${first}`, { title: "" })).status).toBe(400);
    expect(await ids()).toEqual([first, second]);

    const deleted = await ctx.request<Thread>("DELETE", `/ai/threads/${first}`);
    expect(deleted.body.deletedAt).toBeNumber();
    expect(await ids()).toEqual([second]);
    expect((await ctx.request("GET", `/ai/threads/${first}`)).status).toBe(404);
    const restored = await ctx.request<Thread>("POST", `/ai/threads/${first}/restore`);
    expect(restored.body.deletedAt).toBeNull();
    expect((await ctx.request<Thread>("GET", `/ai/threads/${first}`)).body.messages).toHaveLength(
      2,
    );
    expect((await ctx.request("DELETE", `/ai/threads/${newId()}`)).status).toBe(404);
  });

  test("another user can't see, rename or delete my chats", async () => {
    const { ai, ctx, say } = await setup();
    const other = await ctx.tokenFor("other-user", "other@example.com");
    const threadId = newId();
    ai.queueChat({ content: "Ok." });
    await say("my private chat", { threadId });
    expect((await ctx.request("GET", `/ai/threads/${threadId}`, undefined, as(other))).status).toBe(
      404,
    );
    expect(
      (await ctx.request("PATCH", `/ai/threads/${threadId}`, { title: "x" }, as(other))).status,
    ).toBe(404);
    expect(
      (await ctx.request("DELETE", `/ai/threads/${threadId}`, undefined, as(other))).status,
    ).toBe(404);
    expect((await ctx.request<Summary[]>("GET", "/ai/threads", undefined, as(other))).body).toEqual(
      [],
    );
  });

  test("titles come from the first user message, on one line, at most 60 characters", () => {
    expect(threadTitle([{ role: "user", content: "  hello\n  there " }])).toBe("hello there");
    const long = threadTitle([
      {
        role: "user",
        content: "Please move every task from tomorrow to Friday and add a reminder",
      },
    ]);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long).toBe("Please move every task from tomorrow to Friday and add a");
    expect(threadTitle([{ role: "user", content: "   " }])).toBe("New chat");
  });
});

describe("thumbs up or down", () => {
  const OWNER = { env: { OWNER_EMAIL: "test@example.com" } };

  test("rates a stored reply and shows the owner counts and comments, never the chat", async () => {
    const { ai, ctx } = await setup(OWNER);
    const asha = await ctx.tokenFor("sub-asha", "asha@example.com");
    ai.queueChat({ content: "Secret reply one." }, { content: "Secret reply two." });
    const mine = await chat(ctx, [{ role: "user", content: "secret question" }], ctx.token, {
      threadId: newId(),
    });
    const hers = await chat(ctx, [{ role: "user", content: "secret question" }], asha, {
      threadId: newId(),
    });

    const up = await ctx.request("POST", "/ai/feedback", {
      messageId: mine.body.messageId,
      rating: "up",
    });
    expect(up.status).toBe(200);
    await ctx.request(
      "POST",
      "/ai/feedback",
      { messageId: hers.body.messageId, rating: "down", comment: "Wrong account" },
      as(asha),
    );
    const thread = await ctx.request<Thread>("GET", `/ai/threads/${mine.body.threadId}`);
    expect(thread.body.messages[1]!.rating).toBe("up");

    const feedback = await ctx.request<{
      month: string;
      up: number;
      down: number;
      comments: { email: string; rating: string; comment: string; createdAt: number }[];
    }>("GET", "/admin/feedback");
    expect(feedback.body).toMatchObject({ month: "2026-10", up: 1, down: 1 });
    expect(feedback.body.comments).toEqual([
      {
        email: "asha@example.com",
        rating: "down",
        comment: "Wrong account",
        createdAt: expect.any(Number),
      },
    ]);
    expect(JSON.stringify(feedback.body)).not.toContain("Secret");
    expect((await ctx.request("GET", "/admin/feedback", undefined, as(asha))).status).toBe(403);
    const other = await ctx.request<{ up: number }>("GET", "/admin/feedback?month=2026-09");
    expect(other.body.up).toBe(0);

    // Rating again replaces the earlier rating instead of counting twice.
    await ctx.request("POST", "/ai/feedback", { messageId: mine.body.messageId, rating: "down" });
    const again = await ctx.request<{ up: number; down: number }>("GET", "/admin/feedback");
    expect(again.body).toMatchObject({ up: 0, down: 2 });

    // Deleting an account takes its feedback with it.
    const ashaId = ctx.deps.users.list().find((u) => u.email === "asha@example.com")!.id;
    await ctx.request("DELETE", `/admin/users/${ashaId}`, { confirmEmail: "asha@example.com" });
    const gone = await ctx.request<{ down: number; comments: unknown[] }>("GET", "/admin/feedback");
    expect(gone.body).toMatchObject({ down: 1, comments: [] });
  });

  test("only Tiki's own stored replies can be rated, and comments are short", async () => {
    const { ai, ctx, say } = await setup();
    const other = await ctx.tokenFor("other-user", "other@example.com");
    const threadId = newId();
    ai.queueChat({ content: "Ok." });
    const res = await say("hi", { threadId });
    const userMessage = (await ctx.request<Thread>("GET", `/ai/threads/${threadId}`)).body
      .messages[0]!;
    for (const [messageId, token] of [
      [newId(), ctx.token],
      [userMessage.id, ctx.token],
      [res.body.messageId, other],
    ] as const) {
      const rated = await ctx.request(
        "POST",
        "/ai/feedback",
        { messageId, rating: "up" },
        as(token),
      );
      expect(rated.status).toBe(404);
    }
    const long = await ctx.request("POST", "/ai/feedback", {
      messageId: res.body.messageId,
      rating: "down",
      comment: "x".repeat(501),
    });
    expect(long.status).toBe(400);
  });
});
