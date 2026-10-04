import { localDateSchema } from "@tick-taka/shared/schemas/common";
import { monthQuerySchema } from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { dateQuery } from "../../lib/params";
import { validate } from "../../lib/validate";
import { monthlyReview, shutdownReview, weeklyReview } from "./service";

const weekQuery = z.object({ weekStart: localDateSchema.optional() });

export const reviewsRoutes = (deps: Deps) =>
  new Hono()
    .get("/weekly", validate("query", weekQuery), (c) =>
      c.json(weeklyReview(deps, c.req.valid("query").weekStart)),
    )
    .get("/monthly", validate("query", monthQuerySchema), (c) =>
      c.json(monthlyReview(deps, c.req.valid("query").month)),
    )
    .get("/shutdown", validate("query", dateQuery), (c) =>
      c.json(shutdownReview(deps, c.req.valid("query").date)),
    );
