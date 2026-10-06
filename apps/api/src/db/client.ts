import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { type BunSQLiteDatabase, drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";

export type Db = BunSQLiteDatabase;

const MIGRATIONS_FOLDER = fileURLToPath(new URL("../../drizzle", import.meta.url));

export interface DbHandle {
  db: Db;
  sqlite: Database;
}

/** Opens the SQLite file in WAL mode with foreign keys on, and runs pending migrations. */
export function openDatabase(path: string): DbHandle {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path, { create: true });
  sqlite.exec("PRAGMA journal_mode = WAL;");
  sqlite.exec("PRAGMA busy_timeout = 5000;");
  sqlite.exec("PRAGMA synchronous = NORMAL;");
  const db = drizzle({ client: sqlite });
  // Adding constraints rebuilds tables (copy, drop, rename). Dropping a table that
  // others reference fails while foreign keys are on, and the PRAGMA can't be changed
  // inside the transaction the migrator opens, so migrations run with it off.
  sqlite.exec("PRAGMA foreign_keys = OFF;");
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  sqlite.exec("PRAGMA foreign_keys = ON;");
  const broken = sqlite.query("PRAGMA foreign_key_check").all();
  if (broken.length > 0)
    console.warn(`${path}: ${broken.length} rows link to records that don't exist`, broken);
  return { db, sqlite };
}
