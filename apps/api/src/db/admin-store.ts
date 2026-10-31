import type { Database } from "bun:sqlite";

/** What the owner has set for one account, overriding the server's defaults. */
export interface UserControls {
  /** Can't sign in or use a session. */
  blocked: boolean;
  /** Every AI feature refuses, whatever the user's own settings say. */
  aiDisabled: boolean;
  /** Monthly AI cost cap in micro-dollars; null follows AI_USER_MONTHLY_CAP_MICROS. */
  aiCapMicros: number | null;
}

export type SignupMode = "open" | "invite";

export const NO_CONTROLS: UserControls = { blocked: false, aiDisabled: false, aiCapMicros: null };

export type AdminStore = ReturnType<typeof createAdminStore>;

/**
 * The owner's levers, in users.db beside the users: per-account controls, whether
 * new accounts may sign up, and the emails invited while sign-ups are invite-only.
 */
export function createAdminStore(registry: Database, now: () => number) {
  registry.exec(`CREATE TABLE IF NOT EXISTS user_controls (
    user_id TEXT PRIMARY KEY,
    blocked INTEGER NOT NULL DEFAULT 0,
    ai_disabled INTEGER NOT NULL DEFAULT 0,
    ai_cap_micros INTEGER,
    updated_at INTEGER NOT NULL
  )`);
  registry.exec(`CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);
  registry.exec(`CREATE TABLE IF NOT EXISTS allowed_emails (
    email TEXT PRIMARY KEY,
    added_at INTEGER NOT NULL
  )`);

  const controlsOf = registry.query<
    { blocked: number; ai_disabled: number; ai_cap_micros: number | null },
    [string]
  >("SELECT blocked, ai_disabled, ai_cap_micros FROM user_controls WHERE user_id = ?");
  const allControls = registry.query<
    { user_id: string; blocked: number; ai_disabled: number; ai_cap_micros: number | null },
    []
  >("SELECT user_id, blocked, ai_disabled, ai_cap_micros FROM user_controls");
  const putControls = registry.query(
    `INSERT INTO user_controls (user_id, blocked, ai_disabled, ai_cap_micros, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (user_id) DO UPDATE SET blocked = ?2, ai_disabled = ?3, ai_cap_micros = ?4,
       updated_at = ?5`,
  );
  const removeControls = registry.query("DELETE FROM user_controls WHERE user_id = ?");
  const getConfig = registry.query<{ value: string }, [string]>(
    "SELECT value FROM app_config WHERE key = ?",
  );
  const putConfig = registry.query(
    "INSERT INTO app_config (key, value) VALUES (?1, ?2) ON CONFLICT (key) DO UPDATE SET value = ?2",
  );
  const listAllowed = registry.query<{ email: string; added_at: number }, []>(
    "SELECT email, added_at FROM allowed_emails ORDER BY added_at DESC",
  );
  const isAllowed = registry.query<{ n: number }, [string]>(
    "SELECT count(*) AS n FROM allowed_emails WHERE email = ?",
  );
  const addAllowed = registry.query(
    "INSERT INTO allowed_emails (email, added_at) VALUES (?, ?) ON CONFLICT (email) DO NOTHING",
  );
  const removeAllowed = registry.query("DELETE FROM allowed_emails WHERE email = ?");

  const toControls = (row: {
    blocked: number;
    ai_disabled: number;
    ai_cap_micros: number | null;
  }): UserControls => ({
    blocked: row.blocked === 1,
    aiDisabled: row.ai_disabled === 1,
    aiCapMicros: row.ai_cap_micros,
  });

  return {
    controls(userId: string): UserControls {
      const row = controlsOf.get(userId);
      return row ? toControls(row) : NO_CONTROLS;
    },
    allControls(): Map<string, UserControls> {
      return new Map(allControls.all().map((row) => [row.user_id, toControls(row)]));
    },
    setControls(userId: string, next: UserControls): void {
      putControls.run(
        userId,
        next.blocked ? 1 : 0,
        next.aiDisabled ? 1 : 0,
        next.aiCapMicros,
        now(),
      );
    },
    removeForUser(userId: string): void {
      removeControls.run(userId);
    },

    signupMode(): SignupMode {
      return getConfig.get("signup_mode")?.value === "invite" ? "invite" : "open";
    },
    setSignupMode(mode: SignupMode): void {
      putConfig.run("signup_mode", mode);
    },
    allowedEmails(): { email: string; addedAt: number }[] {
      return listAllowed.all().map((row) => ({ email: row.email, addedAt: row.added_at }));
    },
    isAllowed(email: string): boolean {
      return (isAllowed.get(email.toLowerCase())?.n ?? 0) > 0;
    },
    allow(email: string): void {
      addAllowed.run(email.trim().toLowerCase(), now());
    },
    disallow(email: string): void {
      removeAllowed.run(email.trim().toLowerCase());
    },
  };
}
