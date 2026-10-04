import type { Database } from "bun:sqlite";
import type { AiClient } from "../ai/client";
import type { Db } from "../db/client";
import type { Env } from "../env";

/** Everything a route needs, injected so tests can swap the clock, DB and AI. */
export interface Deps {
  db: Db;
  sqlite: Database;
  env: Env;
  now: () => number;
  ai: AiClient | null;
}
