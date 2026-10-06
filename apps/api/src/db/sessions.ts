import type { Database } from "bun:sqlite";

/** One signed-in device. The JWT's `jti` is the session id, so a session can be revoked. */
export interface Session {
  id: string;
  userId: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
  revokedAt: number | null;
}

interface SessionRow {
  id: string;
  user_id: string;
  created_at: number;
  last_used_at: number;
  expires_at: number;
  revoked_at: number | null;
}

const toSession = (row: SessionRow): Session => ({
  id: row.id,
  userId: row.user_id,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
});

/** last_used_at is written at most this often, so reads don't turn into writes. */
const TOUCH_EVERY_MS = 60_000;
/** Expired and revoked sessions are kept this long (for support questions), then dropped. */
const KEEP_DEAD_MS = 7 * 24 * 60 * 60 * 1000;

export type SessionStore = ReturnType<typeof createSessionStore>;

/** Sessions live in users.db next to the users they belong to. */
export function createSessionStore(registry: Database, now: () => number) {
  registry.exec(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_used_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`);
  registry.exec("CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions (user_id)");

  const byId = registry.query<SessionRow, [string]>("SELECT * FROM sessions WHERE id = ?");
  const insert = registry.query(
    `INSERT INTO sessions (id, user_id, created_at, last_used_at, expires_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, NULL)`,
  );
  const touch = registry.query("UPDATE sessions SET last_used_at = ? WHERE id = ?");
  const revoke = registry.query(
    "UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
  );
  const removeForUser = registry.query("DELETE FROM sessions WHERE user_id = ?");
  const prune = registry.query(
    "DELETE FROM sessions WHERE expires_at < ? OR (revoked_at IS NOT NULL AND revoked_at < ?)",
  );

  return {
    create(id: string, userId: string, expiresAt: number): Session {
      const at = now();
      prune.run(at - KEEP_DEAD_MS, at - KEEP_DEAD_MS);
      insert.run(id, userId, at, at, expiresAt);
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

    touch(session: Session): void {
      const at = now();
      if (at - session.lastUsedAt >= TOUCH_EVERY_MS) touch.run(at, session.id);
    },

    revoke(id: string): void {
      revoke.run(now(), id);
    },

    removeForUser(userId: string): void {
      removeForUser.run(userId);
    },
  };
}
