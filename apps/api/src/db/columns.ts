import { type SQL, sql } from "drizzle-orm";
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

// CHECK expressions. Written against bare column names because SQLite rebuilds a
// table under a temporary name when constraints change. NULL always passes a CHECK.

/** `column` holds one of `values`. */
export const oneOf = (column: string, values: readonly string[]): SQL =>
  sql.raw(`"${column}" IN (${values.map((value) => `'${value}'`).join(", ")})`);

/** A raw CHECK expression over bare column names. */
export const rule = (expression: string): SQL => sql.raw(expression);

const DATE_GLOB = "'[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'";
const MONTH_GLOB = "'[0-9][0-9][0-9][0-9]-[0-1][0-9]'";

/** `column` is a local date YYYY-MM-DD. */
export const isLocalDate = (column: string): SQL => sql.raw(`"${column}" GLOB ${DATE_GLOB}`);
/** `column` is a local month YYYY-MM. */
export const isLocalMonth = (column: string): SQL => sql.raw(`"${column}" GLOB ${MONTH_GLOB}`);
