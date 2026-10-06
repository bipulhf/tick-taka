import { Hono } from "hono";
import { z } from "zod";
import type { User } from "../../db/user-registry";
import { clientIp } from "../../lib/client-ip";
import type { Deps } from "../../lib/deps";
import { AppError, unauthorized } from "../../lib/errors";
import { currentScope } from "../../lib/user-scope";
import { validate } from "../../lib/validate";
import { requireAuth } from "../../middleware/auth";
import { SlidingWindowLimiter } from "../../middleware/rate-limit";
import { issueSession } from "./session-token";

const googleSchema = z.object({ idToken: z.string().min(20).max(4096) });

export const profileOf = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  pictureUrl: user.pictureUrl,
});

function signedIn() {
  const scope = currentScope();
  if (!scope) throw unauthorized();
  return scope;
}

/**
 * Signing in: the phone's native Google sign-in hands over an ID token for our
 * own session token. Refresh swaps a live token for a fresh one; logout ends it.
 */
export const authRoutes = (deps: Deps) => {
  // 5 attempts per 15 minutes per IP (the spec's limit); see clientIp for which IP.
  const limiter = new SlidingWindowLimiter(5, 15 * 60 * 1000);
  const issue = (user: User, replaces: string | null = null) =>
    issueSession(
      { secret: deps.env.JWT_SECRET, users: deps.users, now: deps.now() },
      user,
      replaces,
    );

  return (
    new Hono()
      .post("/google", validate("json", googleSchema), async (c) => {
        const ip = clientIp(c, deps.env.TRUST_PROXY);
        const now = deps.now();
        const waitMs = limiter.attempt(ip, now);
        if (waitMs > 0) {
          c.header("Retry-After", String(Math.ceil(waitMs / 1000)));
          throw new AppError(
            429,
            "too_many_attempts",
            "Too many attempts. Try again in a few minutes.",
          );
        }
        const profile = await deps.verifyGoogle(c.req.valid("json").idToken);
        const { user, created } = deps.users.signIn(profile);
        limiter.reset(ip);
        // Open (and seed) the new user's database now, so their first screen is ready.
        deps.users.data(user);
        const { token, expiresAt } = await issue(user);
        return c.json({ token, expiresAt, user: profileOf(user), created });
      })
      .post("/refresh", requireAuth(deps), async (c) => {
        const { user, sessionId } = signedIn();
        // Not revoked here: requests the phone already sent with the old token would
        // come back 401. It retires a minute after the new token is first used.
        const { token, expiresAt } = await issue(user, sessionId ?? null);
        return c.json({ token, expiresAt, user: profileOf(user) });
      })
      .post("/logout", requireAuth(deps), (c) => {
        const { sessionId } = signedIn();
        if (sessionId) deps.users.sessions.revoke(sessionId);
        return c.body(null, 204);
      })
      /** Deletes the account and everything stored for it, at once and for good. */
      .delete("/account", requireAuth(deps), (c) => {
        deps.users.remove(signedIn().user);
        return c.body(null, 204);
      })
  );
};

/** GET /me: who is signed in. */
export const meRoutes = () =>
  new Hono().get("/", (c) => {
    const scope = currentScope();
    if (!scope) throw new AppError(401, "unauthorized", "Sign in again");
    return c.json(profileOf(scope.user));
  });
