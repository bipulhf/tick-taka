import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { JwtTokenExpired } from "hono/utils/jwt/types";
import type { Deps } from "../lib/deps";
import { sessionExpired, unauthorized } from "../lib/errors";
import { setRequestUser } from "../lib/log";
import { runAsUser } from "../lib/user-scope";

/**
 * Tokens issued before sessions existed (no jti) can't be revoked. They are honoured
 * until this date, 30 days after sessions shipped, so every installed phone gets the
 * chance to refresh into a session; after it they get `session_expired`, and the app
 * asks to sign in again with its queued writes kept. Remove the branch after it.
 */
export const LEGACY_TOKENS_UNTIL = Date.UTC(2026, 10, 7);

/**
 * Requires `Authorization: Bearer <token>` signed with JWT_SECRET for a live
 * session, then runs the rest of the request as that token's user, against
 * their own database. 401s say `session_expired` when a real session ran out or
 * was signed out, and `unauthorized` when the token is missing or not ours.
 */
export const requireAuth = (deps: Deps) =>
  createMiddleware(async (c, next) => {
    const header = c.req.header("authorization");
    // Header only: a token in a URL ends up in proxy logs and image caches.
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    if (!token) throw unauthorized("Missing sign-in token");
    let payload: Record<string, unknown>;
    try {
      payload = await verify(token, deps.env.JWT_SECRET, "HS256");
    } catch (error) {
      if (error instanceof JwtTokenExpired) throw sessionExpired();
      throw unauthorized("Sign in again");
    }
    // Tokens from the single-user days carry no user, so they sign out once.
    const user = typeof payload.sub === "string" ? deps.users.find(payload.sub) : undefined;
    if (!user) throw unauthorized("Sign in with Google to continue");
    // Tokens issued before sessions existed have no jti; see LEGACY_TOKENS_UNTIL.
    let sessionId: string | undefined;
    if (payload.jti === undefined) {
      if (deps.now() >= LEGACY_TOKENS_UNTIL) throw sessionExpired();
    } else {
      const session =
        typeof payload.jti === "string" ? deps.users.sessions.find(payload.jti) : null;
      if (!session || session.userId !== user.id || !deps.users.sessions.isLive(session))
        throw sessionExpired();
      deps.users.sessions.touch(session);
      sessionId = session.id;
    }
    setRequestUser(c.req.raw, user.id);
    // Leased so the handle stays open for the whole request.
    const lease = deps.users.lease(user);
    try {
      await runAsUser({ user, data: lease.data, sessionId }, () => next());
    } finally {
      lease.release();
    }
  });
