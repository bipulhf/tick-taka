import { Hono } from "hono";
import { sign } from "hono/jwt";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { AppError } from "../../lib/errors";
import { validate } from "../../lib/validate";
import { SlidingWindowLimiter } from "../../middleware/rate-limit";

export const TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const loginSchema = z.object({ password: z.string().min(1).max(200) });

export const authRoutes = (deps: Deps) => {
  // 5 attempts per 15 minutes per IP, read from the X-Real-IP header Nginx sets.
  const limiter = new SlidingWindowLimiter(5, 15 * 60 * 1000);
  const passwordHash = atob(deps.env.APP_PASSWORD_HASH);

  return new Hono().post("/login", validate("json", loginSchema), async (c) => {
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
    const ok = await Bun.password.verify(c.req.valid("json").password, passwordHash);
    if (!ok) throw new AppError(401, "invalid_password", "That password didn't work");
    limiter.reset(ip);
    const issuedAt = Math.floor(now / 1000);
    const expiresAt = issuedAt + TOKEN_TTL_SECONDS;
    const token = await sign(
      { sub: "me", iat: issuedAt, exp: expiresAt },
      deps.env.JWT_SECRET,
      "HS256",
    );
    return c.json({ token, expiresAt: expiresAt * 1000 });
  });
};
