import { localMonthSchema } from "@tick-taka/shared/schemas/common";
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import type { User } from "../../db/user-registry";
import type { Deps } from "../../lib/deps";
import { badRequest, forbidden, notFound } from "../../lib/errors";
import { isOwner } from "../../lib/owner";
import { idParam } from "../../lib/params";
import { currentScope } from "../../lib/user-scope";
import { validate } from "../../lib/validate";
import { adminAi, adminHealth, adminOverview, adminUsage, adminUsers } from "./stats";

const controlsPatch = z
  .object({
    blocked: z.boolean(),
    aiDisabled: z.boolean(),
    /** Micro-dollars a month; null follows the server's cap. */
    aiCapMicros: z.number().int().positive().max(1_000_000_000).nullable(),
  })
  .partial();

const deleteBody = z.object({ confirmEmail: z.string().trim().min(3).max(320) });
const accessBody = z.object({ mode: z.enum(["open", "invite"]) });
const emailBody = z.object({ email: z.email().max(320) });
const emailParam = z.object({ email: z.email().max(320) });
const monthQuery = z.object({ month: localMonthSchema.optional() });

/**
 * The owner's dashboard and levers (OWNER_EMAIL only). Account facts and counts,
 * never anyone's records. The owner can't block, limit, sign out or delete
 * themselves from here.
 */
export const adminRoutes = (deps: Deps) => {
  const ownerOnly = createMiddleware(async (_c, next) => {
    const me = currentScope()?.user;
    if (!me || !isOwner(deps.env, me)) throw forbidden("Only the owner can open the admin area");
    await next();
  });

  /** Another user's account; never the owner's own. */
  const target = (id: string): User => {
    const user = deps.users.find(id);
    if (!user) throw notFound("User");
    if (isOwner(deps.env, user)) throw badRequest("That's the owner's own account");
    return user;
  };

  return new Hono()
    .use(ownerOnly)
    .get("/overview", (c) => c.json(adminOverview(deps)))
    .get("/users", (c) => c.json(adminUsers(deps)))
    .get("/usage", (c) => c.json(adminUsage(deps)))
    .get("/ai", validate("query", monthQuery), (c) =>
      c.json(adminAi(deps, c.req.valid("query").month)),
    )
    .get("/health", (c) => c.json(adminHealth(deps)))
    .patch("/users/:id", validate("param", idParam), validate("json", controlsPatch), (c) => {
      const user = target(c.req.valid("param").id);
      const next = { ...deps.users.admin.controls(user.id), ...c.req.valid("json") };
      deps.users.admin.setControls(user.id, next);
      // Blocked means signed out everywhere, now.
      if (next.blocked) deps.users.sessions.revokeForUser(user.id);
      return c.json(next);
    })
    .post("/users/:id/sign-out", validate("param", idParam), (c) => {
      deps.users.sessions.revokeForUser(target(c.req.valid("param").id).id);
      return c.body(null, 204);
    })
    .delete("/users/:id", validate("param", idParam), validate("json", deleteBody), (c) => {
      const user = target(c.req.valid("param").id);
      if (c.req.valid("json").confirmEmail.toLowerCase() !== user.email)
        throw badRequest("Type the account's email exactly to delete it");
      deps.users.remove(user);
      return c.body(null, 204);
    })
    .get("/access", (c) =>
      c.json({ mode: deps.users.admin.signupMode(), emails: deps.users.admin.allowedEmails() }),
    )
    .put("/access", validate("json", accessBody), (c) => {
      deps.users.admin.setSignupMode(c.req.valid("json").mode);
      return c.json({ mode: deps.users.admin.signupMode() });
    })
    .post("/access/emails", validate("json", emailBody), (c) => {
      deps.users.admin.allow(c.req.valid("json").email);
      return c.json({ emails: deps.users.admin.allowedEmails() }, 201);
    })
    .delete("/access/emails/:email", validate("param", emailParam), (c) => {
      deps.users.admin.disallow(c.req.valid("param").email);
      return c.json({ emails: deps.users.admin.allowedEmails() });
    });
};
