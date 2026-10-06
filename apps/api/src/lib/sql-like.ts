import { type SQL, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

/** `%text%`, with LIKE's wildcards and the escape character in `text` matched literally. */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

/**
 * Case-insensitive "contains" search. SQLite only treats the backslash as an escape
 * when the query names it with ESCAPE, which Drizzle's like() does not add.
 */
export function likeContains(column: SQLiteColumn, text: string): SQL {
  return sql`${column} LIKE ${containsPattern(text)} ESCAPE '\\'`;
}
