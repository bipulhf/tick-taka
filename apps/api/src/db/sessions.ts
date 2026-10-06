import type { Database } from "bun:sqlite";

/** One signed-in device. The JWT's `jti` is the session id, so a session can be revoked. */
export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt: number | null;
  /** The session this one was refreshed from; it stays usable until this one is used. */
  replaces: string | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
  revoked_at: number | null;
  replaces: string | null;
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  replaces: row.replaces,
});

/** last_used_at is written at most this often, so reads don't turn into writes. */
const TOUCH_EVERY_MS = 60_000;
/** Expired and revoked sessions are kept this long (for support questions), then dropped. */
const KEEP_DEAD_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * How long a refreshed-away token keeps working once its replacement is in use,
 * so requests the phone sent with it just before switching still land.
 */
export const REFRESH_GRACE_MS = 60_000;

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Sessions live in users.db next to the users they belong to. */
export function createSessionStore(registry: Database, now: () => number) {
  registry.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    replaces TEXT
  )`);
  // Added after release: a users.db from before gains the column in place.
  const columns = registry.query<{ name: string }, []>("PRAGMA table_info(sessions)").all();
  if (!columns.some((column) => column.name === "replaces"))
    registry.exec("ALTER TABLE sessions ADD COLUMN replaces TEXT");
  registry.exec("CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id)");

  const byId = registry.query<SessionRow, [string]>("SELECT * FROM sessions WHERE id = ?");
  const insert = registry.query(
    `INSERT INTO sessions (id, user_id, created_at, last_used_at, expires_at, revoked_at, replaces)
     VALUES (?, ?, ?, ?, ?, NULL, ?)`,
  );
  const touch = registry.query("UPDATE sessions SET last_used_at = ? WHERE id = ?");
  const shorten = registry.query(
    "UPDATE sessions SET expires_at = ? WHERE id = ? AND expires_at > ?",
  );
  const revoke = registry.query(
    "UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  );
  const removeForUser = registry.query("DELETE FROM sessions WHERE user_id = ?");
  const prune = registry.query(
    "DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",
  );

  return {
    /** `replaces` names the session a refresh came from; see `touch`. */
    create(id: string, userId: string, expiresAt: number, replaces: string | null = null): Session {
      const at = now();
      prune.run(at - KEEP_DEAD_MS, at - KEEP_DEAD_MS);
      insert.run(id, userId, at, at, expiresAt, replaces);
      return toSession(byId.get(id)!);
    },

    find(id: string): Session | undefined {
      const row = byId.get(id);
      return row ? toSession(row) : undefined;
    },

    /** Usable right now: known, not revoked and not past its expiry. */
    isLive(session: Session): boolean {
      return session.revokedAt === null && session.expiresAt > now();
    },

    /**
     * Marks the session used. Using a refreshed token gives the token it replaced
     * one more minute: the phone has switched, so only requests already on their
     * way still carry the old one. Until then the old token keeps working, so a
     * refresh reply lost on the way to the phone signs nobody out.
     */
    touch(session: Session): void {
      const at = now();
      if (at - session.lastUsedAt >= TOUCH_EVERY_MS) touch.run(at, session.id);
      const until = at + REFRESH_GRACE_MS;
      if (session.replaces) shorten.run(until, session.replaces, until);
    },

    /** Ends the session at once, and the one it was refreshed from (logout). */
    revoke(id: string): void {
      const at = now();
      const replaces = byId.get(id)?.replaces;
      revoke.run(at, id);
      if (replaces) revoke.run(at, replaces);
    },

    removeForUser(userId: string): void {
      removeForUser.run(userId);
    },
  };
}
