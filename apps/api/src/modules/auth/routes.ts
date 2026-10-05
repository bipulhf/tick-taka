import { Hono } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import type { User } from "../../db/user-registry";
import type { Deps } from "../../lib/deps";
import { AppError } from "../../lib/errors";
import { currentScope } from "../../lib/user-scope";
import { validate } from "../../lib/validate";
import { SlidingWindowLimiter } from "../../middleware/rate-limit";

export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const googleSchema = z.object({ idToken: z.string().min(20).max(4096) });

export const profileOf = (user: User) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  pictureUrl: user.pictureUrl,
});

/** Signing in: the phone's native Google sign-in hands over an ID token for our own. */
export const authRoutes = (deps: Deps) => {
  // 10 attempts per 15 minutes per IP, read from the X-Real-IP header Nginx sets.
  const limiter = new SlidingWindowLimiter(10, 15 * 60 * 1000);

  return new Hono().post("/google", validate("json", googleSchema), async (c) => {
    const ip = c.req.header("x-real-ip") ?? "local";
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
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + TOKEN_TTL_SECONDS;
    const token = await sign(
      { sub: user.id, iat: issuedAt, exp: expiresAt },
      deps.env.JWT_SECRET,
      "HS256",
    );
    return c.json({ token, expiresAt: expiresAt * 1000, user: profileOf(user), created });
  });
};

/** GET /me: who is signed in. */
export const meRoutes = () =>
  new Hono().get("/", (c) => {
    const scope = currentScope();
    if (!scope) throw new AppError(401, "unauthorized", "Sign in again");
    return c.json(profileOf(scope.user));
  });
