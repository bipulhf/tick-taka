import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { baseColumns } from "../columns";

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const aiUsage = sqliteTable(
  "ai_usage",
  {
    ...baseColumns(),
    feature: text("feature").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicros: integer("cost_micros").notNull().default(0),
  },
  (t) => [index("ai_usage_created_at_idx").on(t.createdAt)],
);
