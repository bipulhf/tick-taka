import type { Database } from "bun:sqlite";
import type { AiClient } from "../ai/client";
import type { Db } from "../db/client";
import type { GoogleProfile, UserRegistry } from "../db/user-registry";
import type { Env } from "../env";
import { currentScope, type UserScope } from "./user-scope";

/** Checks a Google ID token and returns who it belongs to; throws when it isn't valid. */
export type GoogleVerifier = (idToken: string) => Promise<GoogleProfile>;

/** Everything a route needs, injected so tests can swap the clock, DB and AI. */
export interface Deps {
  /** The signed-in user's database; reading it outside a user's request throws. */
  readonly db: Db;
  readonly sqlite: Database;
  /** Where the signed-in user's receipt photos live. */
  readonly uploadsDir: string;
  env: Env;
  now: () => number;
  ai: AiClient | null;
  users: UserRegistry;
  verifyGoogle: GoogleVerifier;
}

type SharedDeps = Omit<Deps, "db" | "sqlite" | "uploadsDir">;

/**
 * Builds deps whose `db`, `sqlite` and `uploadsDir` follow the user of the current
 * request (see runAsUser). `fallback` serves calls made outside a request; only
 * tests use it.
 */
export function createDeps(shared: SharedDeps, fallback?: () => UserScope): Deps {
  const scope = (): UserScope => {
    const current = currentScope() ?? fallback?.();
    if (!current) throw new Error("No signed-in user for this database call");
    return current;
  };
  return {
    ...shared,
    get db() {
      return scope().data.db;
    },
    get sqlite() {
      return scope().data.sqlite;
    },
    get uploadsDir() {
      return scope().data.uploadsDir;
    },
  };
}
