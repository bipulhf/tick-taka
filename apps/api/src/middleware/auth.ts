import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { Deps } from "../lib/deps";
import { unauthorized } from "../lib/errors";
import { runAsUser } from "../lib/user-scope";

/**
 * Requires `Authorization: Bearer <token>` signed with JWT_SECRET, then runs the
 * rest of the request as that token's user, against their own database.
 */
export const requireAuth = (deps: Deps) =>
  createMiddleware(async (c, next) => {
    const header = c.req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7).trim() : undefined;
    // Receipt images are opened by the phone's image view, which can only add a query token.
    const queryToken = c.req.path.startsWith("/uploads/") ? c.req.query("token") : undefined;
    const candidate = token ?? queryToken;
    if (!candidate) throw unauthorized("Missing sign-in token");
    let userId: unknown;
    try {
      userId = (await verify(candidate, deps.env.JWT_SECRET, "HS256")).sub;
    } catch {
      throw unauthorized("Your session has expired. Sign in again.");
    }
    // Tokens from the single-user days carry no user, so they sign out once.
    const user = typeof userId === "string" ? deps.users.find(userId) : undefined;
    if (!user) throw unauthorized("Sign in with Google to continue");
    await runAsUser({ user, data: deps.users.data(user) }, () => next());
  });
