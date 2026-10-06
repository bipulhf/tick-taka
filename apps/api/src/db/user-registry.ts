import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { defined } from "@tick-taka/shared/defined";
import { newId } from "@tick-taka/shared/ids";
import type { Env } from "../env";
import { errorFields, log, userTag } from "../lib/log";
import { type DbHandle, openDatabase } from "./client";
import { createHandleCache } from "./handle-cache";
import { createJobRunStore } from "./job-runs";
import { seedDefaults } from "./seed";
import { createSessionStore } from "./sessions";
import { createUsageTotalStore } from "./usage-totals";
import { deleteUserFiles } from "./user-files";

/** Open user databases: at most 50, each closed after 10 idle minutes. */
const HANDLE_LIMITS = { max: 50, idleMs: 10 * 60_000, minIdleMs: 30_000 };

export interface User {
  id: string;
  googleSub: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
  /** Owns the single-user database at DB_PATH (and the uploads and backups beside it). */
  legacy: boolean;
  createdAt: number;
  lastSeenAt: number;
}

/** What Google vouches for about the person signing in. */
export interface GoogleProfile {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

/** One user's own database and folders. Nothing in here is shared with anyone else. */
export interface UserData extends DbHandle {
  uploadsDir: string;
  backupsDir: string;
}

interface UserRow {
  id: string;
  google_sub: string;
  email: string;
  name: string | null;
  picture_url: string | null;
  legacy: number;
  created_at: number;
  last_seen_at: number;
}

const toUser = (row: UserRow): User => ({
  id: row.id,
  googleSub: row.google_sub,
  email: row.email,
  name: row.name,
  pictureUrl: row.picture_url,
  legacy: row.legacy === 1,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
});

export type UserRegistry = ReturnType<typeof createUserRegistry>;

/**
 * Who can sign in, and where each person's data lives: a small users.db listing
 * Google accounts, and one SQLite file per user, so no query can ever reach
 * someone else's rows. Sign-up is open: a new Google account gets a fresh,
 * seeded database on first sign-in.
 */
export function createUserRegistry(
  env: Env,
  now: () => number,
  options: { seed?: boolean; handles?: Partial<typeof HANDLE_LIMITS> } = {},
) {
  if (env.USERS_DB_PATH !== ":memory:") mkdirSync(dirname(env.USERS_DB_PATH), { recursive: true });
  const registry = new Database(env.USERS_DB_PATH, { create: true });
  registry.exec("PRAGMA journal_mode = WAL;");
  registry.exec("PRAGMA busy_timeout = 5000;");
  registry.exec(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    google_sub TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    name TEXT,
    picture_url TEXT,
    legacy INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_seen_at INTEGER NOT NULL
  )`);

  const byId = registry.query<UserRow, [string]>("SELECT * FROM users WHERE id = ?");
  const bySub = registry.query<UserRow, [string]>("SELECT * FROM users WHERE google_sub = ?");
  const all = registry.query<UserRow, []>("SELECT * FROM users ORDER BY created_at");
  const legacyTaken = registry.query<{ n: number }, []>(
    "SELECT count(*) AS n FROM users WHERE legacy = 1",
  );
  const removeUser = registry.query("DELETE FROM users WHERE id = ?");
  const open = createHandleCache<UserData>({ ...HANDLE_LIMITS, ...options.handles, now });
  const sessions = createSessionStore(registry, now);
  const jobRuns = createJobRunStore(registry);
  const usageTotals = createUsageTotalStore(registry);

  /** The owner inherits the single-user data once, on their first sign-in. */
  const claimsLegacy = (email: string) =>
    env.OWNER_EMAIL === email &&
    env.DB_PATH !== ":memory:" &&
    existsSync(env.DB_PATH) &&
    (legacyTaken.get()?.n ?? 0) === 0;

  function dataPaths(user: User) {
    if (user.legacy) return { db: env.DB_PATH, uploads: env.UPLOADS_DIR, backups: env.BACKUPS_DIR };
    return {
      db: env.USER_DATA_DIR === ":memory:" ? ":memory:" : join(env.USER_DATA_DIR, `${user.id}.db`),
      uploads: join(env.UPLOADS_DIR, "users", user.id),
      backups: join(env.BACKUPS_DIR, "users", user.id),
    };
  }

  return {
    /** Signed-in devices; each token's jti names one of these. */
    sessions,
    /** When each nightly job last ran for each user. */
    jobRuns,
    /** Each user's AI use per month, for the owner's report. */
    usageTotals,

    find(id: string): User | undefined {
      const row = byId.get(id);
      return row ? toUser(row) : undefined;
    },

    list(): User[] {
      return all.all().map(toUser);
    },

    /** Finds the user for this Google account, creating them on first sign-in. */
    signIn(profile: GoogleProfile): { user: User; created: boolean } {
      const at = now();
      const email = profile.email.toLowerCase();
      const existing = bySub.get(profile.sub);
      if (existing) {
        registry
          .query(
            "UPDATE users SET email = ?, name = ?, picture_url = ?, last_seen_at = ? WHERE id = ?",
          )
          .run(email, profile.name, profile.picture, at, existing.id);
        return { user: toUser(defined(byId.get(existing.id), "the user")), created: false };
      }
      const id = newId(at);
      registry
        .query(
          `INSERT INTO users (id, google_sub, email, name, picture_url, legacy, created_at, last_seen_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          id,
          profile.sub,
          email,
          profile.name,
          profile.picture,
          claimsLegacy(email) ? 1 : 0,
          at,
          at,
        );
      return { user: toUser(defined(byId.get(id), "the new user")), created: true };
    },

    /**
     * Returns this user's database, opening it (and seeding defaults on first use)
     * if it isn't open. For work that spans awaits, use `lease` so the handle
     * can't be closed underneath it. Refuses a user whose account was deleted, so
     * a late caller can't recreate their database.
     */
    data(user: User): UserData {
      const cached = open.get(user.id);
      if (cached) return cached;
      if (!byId.get(user.id)) throw new Error("This account was deleted");
      const paths = dataPaths(user);
      let handle: DbHandle;
      try {
        handle = openDatabase(paths.db);
      } catch (error) {
        // Usually a migration that refused an old row: say whose, so it can be repaired.
        log("error", "user database failed to open", {
          user: userTag(user.id, env.JWT_SECRET),
          ...errorFields(error),
        });
        throw error;
      }
      if (options.seed !== false) seedDefaults(handle.db, now());
      const data = { ...handle, uploadsDir: paths.uploads, backupsDir: paths.backups };
      open.set(user.id, data);
      open.sweep();
      return data;
    },

    /**
     * This user's database, kept open until `release` is called. A handle opened
     * just for this lease can be closed on release (`{ closeIfOpened: true }`), as
     * the nightly jobs do, so a run over every user doesn't leave them all open.
     */
    lease(user: User): { data: UserData; release: (opts?: { closeIfOpened?: boolean }) => void } {
      const opened = !open.get(user.id);
      const data = this.data(user);
      open.acquire(user.id);
      let released = false;
      return {
        data,
        release(opts = {}) {
          if (released) return;
          released = true;
          open.release(user.id);
          if (opened && opts.closeIfOpened) open.closeIfIdle(user.id);
        },
      };
    },

    /**
     * Deletes the account: its sessions, its database files, receipt photos and
     * backups, and the users row. Tokens for it stop working at once.
     */
    remove(user: User): void {
      sessions.removeForUser(user.id);
      jobRuns.removeForUser(user.id);
      usageTotals.removeForUser(user.id);
      open.close(user.id);
      deleteUserFiles(dataPaths(user), user.legacy);
      removeUser.run(user.id);
    },

    /** Closes handles nobody has used for a while. Called on a timer and after jobs. */
    sweep(): void {
      open.sweep();
    },

    /** How many user databases are open, for tests and health checks. */
    get openHandles(): number {
      return open.size;
    },
  };
}
