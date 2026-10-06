import { z } from "zod";

/**
 * Session rules without React Native, so they can be tested: what a stored or
 * returned session must look like, when to refresh it, and when signing in has to
 * wipe the phone.
 */

export const TOKEN_KEY = "tt.token";
export const PROFILE_KEY = "tt.profile";
/** When this phone got the current token (ms). Missing on tokens from older builds. */
export const ISSUED_KEY = "tt.token-issued";

/** Tokens slide: one older than this is swapped for a fresh one on start or foreground. */
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
  /** Kept after a session expires, so the same person can sign back in without a wipe. */
  profile: Profile | null;
  issuedAt: number | null;
}

const SIGNED_OUT: StoredSession = { token: null, profile: null, issuedAt: null };

function parseProfile(raw: string | null): Profile | null {
  if (!raw) return null;
  try {
    const result = profileSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Reads the session from secure storage. Never throws: if the store can't be read
 * (Android Keystore reset, restored backup) the result is "signed out", so the app
 * opens on the login screen instead of hanging on the splash screen. `broken` says
 * the stored keys should be deleted.
 */
export async function readStoredSession(
  getItem: (key: string) => Promise<string | null>,
): Promise<StoredSession & { broken: boolean }> {
  try {
    const [token, profile, issued] = await Promise.all([
      getItem(TOKEN_KEY),
      getItem(PROFILE_KEY),
      getItem(ISSUED_KEY),
    ]);
    const issuedAt = issued ? Number(issued) : Number.NaN;
    return {
      token: token || null,
      profile: parseProfile(profile),
      issuedAt: Number.isFinite(issuedAt) ? issuedAt : null,
      broken: false,
    };
  } catch {
    return { ...SIGNED_OUT, broken: true };
  }
}

/** Whether the token should be refreshed now. Unknown age counts as old. */
export function needsRefresh(issuedAt: number | null, now: number): boolean {
  return issuedAt === null || now - issuedAt >= REFRESH_AFTER_MS;
}

/**
 * Signing in keeps the phone's data (and the queued writes) only for the person they
 * belong to. Anyone else gets a clean phone first.
 */
export function mustWipeBeforeSignIn(previousUserId: string | null, nextUserId: string): boolean {
  return previousUserId !== null && previousUserId !== nextUserId;
}
