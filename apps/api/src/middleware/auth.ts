import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import { unauthorized } from "../lib/errors";

/** Requires `Authorization: Bearer <token>` signed with JWT_SECRET. */
export const requireAuth = (secret: string) =>
  createMiddleware(async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    // Receipt images are opened by the phone's image view, which can only add a query token.
    const queryToken = c.req.path.startsWith("/uploads/") ? c.req.query("token") : undefined;
    const candidate = token ?? queryToken;
    if (!candidate) throw unauthorized("Missing sign-in token");
    try {
      await verify(candidate, secret, "HS256");
    } catch {
      throw unauthorized("Your session has expired. Sign in again.");
    }
    await next();
  });
