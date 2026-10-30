import { z } from "zod";

/** What a stored or returned session must look like, and when to refresh it. */

export const TOKEN_KEY = "tt.token";
export const PROFILE_KEY = "tt.profile";
/** When this browser got the current token (ms). */
export const ISSUED_KEY = "tt.token-issued";

/** Tokens slide: one older than this is swapped for a fresh one on start or focus. */
export const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

export const profileSchema = z.object({
  id: z.string().min(1),
  email: z.string(),
  name: z.string().nullable(),
  pictureUrl: z.string().nullable(),
});

export type Profile = z.infer<typeof profileSchema>;

/** Reply of POST /auth/google and POST /auth/refresh. */
export const sessionResponseSchema = z.object({
  token: z.string().min(1),
  expiresAt: z.number().optional(),
  user: profileSchema,
});

export type SessionResponse = z.infer<typeof sessionResponseSchema>;

export interface StoredSession {
  token: string | null;
  profile: Profile | null;
  issuedAt: number | null;
}

function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const result = profileSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/** Reads the session from storage. Never throws: anything unreadable is "signed out". */
export function readStoredSession(storage: Pick<Storage, "getItem">): StoredSession {
  try {
    const issued = Number(storage.getItem(ISSUED_KEY));
    return {
      token: storage.getItem(TOKEN_KEY) || null,
      profile: parseProfile(storage.getItem(PROFILE_KEY)),
      issuedAt: Number.isFinite(issued) && issued > 0 ? issued : null,
    };
  } catch {
    return { token: null, profile: null, issuedAt: null };
  }
}

/** Whether the token should be refreshed now. Unknown age counts as old. */
export function needsRefresh(issuedAt: number | null, now: number): boolean {
  return issuedAt === null || now - issuedAt >= REFRESH_AFTER_MS;
}
