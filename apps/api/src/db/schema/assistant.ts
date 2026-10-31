import type { AssistantCard, AssistantQuestion } from "@tick-taka/shared/schemas/ai";
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { baseColumns, oneOf } from "../columns";

const ROLES = ["user", "assistant"] as const;
const RATINGS = ["up", "down"] as const;

/** One chat with Tiki. Deleting is soft, so the app's Undo can bring it back. */
export const assistantThreads = sqliteTable(
  "assistant_threads",
  {
    ...baseColumns(),
    title: text("title").notNull(),
  },
  (t) => [index("assistant_threads_updated_at_idx").on(t.updatedAt)],
);

/** A message in a chat: what the user wrote, or Tiki's reply with what it did. */
export const assistantMessages = sqliteTable(
  "assistant_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => assistantThreads.id),
    role: text("role", { enum: ROLES }).notNull(),
    content: text("content").notNull(),
    /** What Tiki changed, with ids, passed back to it on follow-ups. */
    memo: text("memo"),
    cards: text("cards", { mode: "json" }).$type<AssistantCard[]>(),
    /** The changes made, as their summaries (no Undo: that belongs to the turn that made them). */
    actions: text("actions", { mode: "json" }).$type<{ summary: string }[]>(),
    /** Tiki's question as a small form, when the reply asked one (TIKI_V2 §11). */
    question: text("question", { mode: "json" }).$type<AssistantQuestion>(),
    rating: text("rating", { enum: RATINGS }),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [
    index("assistant_messages_thread_idx").on(t.threadId, t.createdAt),
    check("assistant_messages_role_check", oneOf("role", ROLES)),
    check("assistant_messages_rating_check", oneOf("rating", RATINGS)),
  ],
);
