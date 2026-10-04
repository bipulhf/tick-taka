import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { dateQuery } from "../../lib/params";
import { validate } from "../../lib/validate";
import { todayView } from "./service";

export const todayRoutes = (deps: Deps) =>
  new Hono().get("/", validate("query", dateQuery), (c) =>
    c.json(todayView(deps, c.req.valid("query").date)),
  );
