import { newId } from "@tick-taka/shared/ids";
import {
  ASSISTANT_RECORD_KINDS,
  type AssistantCard,
  type AssistantMessage,
  type AssistantQuestion,
  type AssistantRating,
  assistantThreadPatchSchema,
} from "@tick-taka/shared/schemas/ai";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Hono } from "hono";
import { assistantMessages, assistantThreads } from "../../../db/schema/assistant";
import type { Deps } from "../../../lib/deps";
import { notFound } from "../../../lib/errors";
import { idParam } from "../../../lib/params";
import { validate } from "../../../lib/validate";

/** Chats listed at once, newest first, and messages returned per chat (the latest). */
const MAX_THREADS = 200;
const MAX_MESSAGES = 500;
const TITLE_LENGTH = 60;

/** A chat's name from its first message: one line, at most 60 characters. */
export function threadTitle(messages: AssistantMessage[]): string {
  const first = messages.find((message) => message.role === "user")?.content ?? "";
  const line = first.replace(/\s+/g, " ").trim();
  if (line.length <= TITLE_LENGTH) return line || "New chat";
  const cut = line.slice(0, TITLE_LENGTH);
  const space = cut.lastIndexOf(" ");
  return (space > TITLE_LENGTH / 2 ? cut.slice(0, space) : cut).trim();
}

// Raw names: inside a subquery drizzle would leave both columns unqualified.
const messageCount = sql<number>`(SELECT count(*) FROM assistant_messages m WHERE m.thread_id = assistant_threads.id)`;

const summaryColumns = {
  id: assistantThreads.id,
  title: assistantThreads.title,
  createdAt: assistantThreads.createdAt,
  updatedAt: assistantThreads.updatedAt,
  deletedAt: assistantThreads.deletedAt,
  messageCount,
};

/** What Tiki's reply leaves behind for the chat: the answer and what it did. */
export interface StoredReply {
  reply: string;
  memo: string;
  cards: AssistantCard[];
  actions: { summary: string }[];
  question: AssistantQuestion | null;
}

/** The signed-in user's chats with Tiki, in their own database. */
export function threadService(deps: Deps) {
  const { db } = deps;

  const summary = (id: string, includeDeleted = false) => {
    const row = db
      .select(summaryColumns)
      .from(assistantThreads)
      .where(
        includeDeleted
          ? eq(assistantThreads.id, id)
          : and(eq(assistantThreads.id, id), isNull(assistantThreads.deletedAt)),
      )
      .get();
    if (!row) throw notFound("Chat");
    return row;
  };

  const touch = (threadId: string, at: number) =>
    db
      .update(assistantThreads)
      .set({ updatedAt: at })
      .where(eq(assistantThreads.id, threadId))
      .run();

  return {
    list() {
      return db
        .select(summaryColumns)
        .from(assistantThreads)
        .where(isNull(assistantThreads.deletedAt))
        .orderBy(desc(assistantThreads.updatedAt), desc(assistantThreads.id))
        .limit(MAX_THREADS)
        .all();
    },

    get(id: string) {
      const thread = summary(id);
      const latest = db
        .select({
          id: assistantMessages.id,
          role: assistantMessages.role,
          content: assistantMessages.content,
          memo: assistantMessages.memo,
          cards: assistantMessages.cards,
          actions: assistantMessages.actions,
          question: assistantMessages.question,
          rating: assistantMessages.rating,
          createdAt: assistantMessages.createdAt,
        })
        .from(assistantMessages)
        .where(eq(assistantMessages.threadId, id))
        .orderBy(desc(assistantMessages.createdAt), desc(assistantMessages.id))
        .limit(MAX_MESSAGES)
        .all();
      return {
        ...thread,
        messages: latest.reverse().map((message) => ({
          ...message,
          // A card for a kind of record the app no longer has (a shopping item) is left out.
          cards: (message.cards ?? []).filter(
            (card) => card.type !== "record" || ASSISTANT_RECORD_KINDS.includes(card.kind),
          ),
          actions: message.actions ?? [],
          question: message.question ?? null,
        })),
      };
    },

    rename(id: string, title: string) {
      summary(id);
      db.update(assistantThreads)
        .set({ title, updatedAt: deps.now() })
        .where(eq(assistantThreads.id, id))
        .run();
      return summary(id);
    },

    /** Soft: the chat disappears from the list and restore brings it back. */
    remove(id: string) {
      const row = summary(id, true);
      if (row.deletedAt !== null) return row;
      const at = deps.now();
      db.update(assistantThreads)
        .set({ deletedAt: at, updatedAt: at })
        .where(eq(assistantThreads.id, id))
        .run();
      return summary(id, true);
    },

    restore(id: string) {
      const row = summary(id, true);
      if (row.deletedAt === null) return row;
      db.update(assistantThreads)
        .set({ deletedAt: null, updatedAt: deps.now() })
        .where(eq(assistantThreads.id, id))
        .run();
      return summary(id);
    },

    /**
     * Starts a turn in the chat: makes the chat on its first message (a deleted one
     * comes back, since the user is writing in it) and stores the user's message.
     * The returned function stores the reply when the turn ends and gives its id.
     */
    begin(threadId: string, messages: AssistantMessage[]): (reply: StoredReply) => string {
      const at = deps.now();
      db.insert(assistantThreads)
        .values({
          id: threadId,
          title: threadTitle(messages),
          createdAt: at,
          updatedAt: at,
          deletedAt: null,
        })
        .onConflictDoUpdate({
          target: assistantThreads.id,
          set: { updatedAt: at, deletedAt: null },
        })
        .run();
      const last = messages.at(-1);
      if (last?.role === "user")
        db.insert(assistantMessages)
          .values({
            id: newId(at),
            threadId,
            role: "user",
            content: last.content,
            createdAt: at,
          })
          .run();
      return (reply) => {
        const now = deps.now();
        const id = newId(now);
        db.insert(assistantMessages)
          .values({
            id,
            threadId,
            role: "assistant",
            content: reply.reply,
            memo: reply.memo || null,
            cards: reply.cards,
            actions: reply.actions,
            question: reply.question,
            createdAt: now,
          })
          .run();
        touch(threadId, now);
        return id;
      };
    },

    /** Saves a thumbs up or down on one of Tiki's stored replies. False when there is none. */
    rate(messageId: string, rating: AssistantRating): boolean {
      const reply = and(
        eq(assistantMessages.id, messageId),
        eq(assistantMessages.role, "assistant"),
      );
      if (!db.select({ id: assistantMessages.id }).from(assistantMessages).where(reply).get())
        return false;
      db.update(assistantMessages).set({ rating }).where(reply).run();
      return true;
    },
  };
}

/** /ai/threads: the chat list, one chat with its messages, rename, delete and restore. */
export const threadRoutes = (deps: Deps) =>
  new Hono()
    .get("/", (c) => c.json(threadService(deps).list()))
    .get("/:id", validate("param", idParam), (c) =>
      c.json(threadService(deps).get(c.req.valid("param").id)),
    )
    .patch("/:id", validate("param", idParam), validate("json", assistantThreadPatchSchema), (c) =>
      c.json(threadService(deps).rename(c.req.valid("param").id, c.req.valid("json").title)),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(threadService(deps).remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(threadService(deps).restore(c.req.valid("param").id)),
    );
