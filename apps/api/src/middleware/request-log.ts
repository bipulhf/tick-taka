import { createMiddleware } from "hono/factory";
import type { Deps } from "../lib/deps";
import { log, requestUserOf, setRequestId, userTag } from "../lib/log";

/** A caller-supplied id is kept only when it looks like one (no log injection). */
const REQUEST_ID = /^[A-Za-z0-9._-]{8,64}$/;

/**
 * Gives every request an id (echoed in `x-request-id`) and logs one line when
 * it finishes: method, path (never the query string), status, duration and a
 * tag for the signed-in user. Bodies and tokens are never logged.
 */
export const requestLog = (deps: Deps) =>
  createMiddleware(async (c, next) => {
    const incoming = c.req.header("x-request-id");
    const requestId = incoming && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
    setRequestId(c.req.raw, requestId);
    const started = performance.now();
    await next();
    c.header("x-request-id", requestId);
    const userId = requestUserOf(c.req.raw);
    log(c.res.status >= 500 ? "error" : "info", "request", {
      reqId: requestId,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms: Math.round(performance.now() - started),
      ...(userId ? { user: userTag(userId, deps.env.JWT_SECRET) } : {}),
    });
  });
