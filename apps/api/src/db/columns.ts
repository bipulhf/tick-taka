import { integer, text } from "drizzle-orm/sqlite-core";

/**
 * Columns every table carries: a ULID primary key generated on the phone, and
 * UTC epoch-millisecond timestamps. Deleting sets `deleted_at` so Undo is trivial.
 */
export const baseColumns = () => ({
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

export const bool = (name: string) => integer(name, { mode: "boolean" });
