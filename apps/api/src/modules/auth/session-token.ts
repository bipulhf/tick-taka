import { newId } from "@tick-taka/shared/ids";
import { sign } from "hono/jwt";
import type { User, UserRegistry } from "../../db/user-registry";

/** Each token lasts 30 days; the phone refreshes it (POST /auth/refresh), so use keeps it alive. */
export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Starts a session for this user and signs a token naming it (`jti`), so the
 * session can be refreshed or revoked on the server.
 */
export async function issueSession(
  options: { secret: string; users: UserRegistry; now: number },
  user: User,
  /** The session being refreshed; it keeps working until the new token is used. */
  replaces: string | null = null,
): Promise<{ token: string; expiresAt: number }> {
  const issuedAt = Math.floor(options.now / 1000);
  const exp = issuedAt + TOKEN_TTL_SECONDS;
  const jti = newId(options.now);
  options.users.sessions.create(jti, user.id, exp * 1000, replaces);
  const token = await sign({ sub: user.id, jti, iat: issuedAt, exp }, options.secret, "HS256");
  return { token, expiresAt: exp * 1000 };
}
