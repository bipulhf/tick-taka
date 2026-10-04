import { rangeQuerySchema } from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { dateQuery } from "../../lib/params";
import { validate } from "../../lib/validate";
import { weeklyRecap } from "./recap";
import { spotSubscriptions } from "./spotter";
import {
  areaDashboard,
  insightsSummary,
  monthlySeries,
  netWorthSeries,
  overallHourlyRate,
} from "./summary";

const monthsQuery = z.object({ months: z.coerce.number().int().min(1).max(36).default(12) });

export const insightsRoutes = (deps: Deps) =>
  new Hono()
    .get("/summary", validate("query", rangeQuerySchema), (c) =>
      c.json(insightsSummary(deps, c.req.valid("query"))),
    )
    .get("/hourly-rate", (c) => c.json(overallHourlyRate(deps)))
    .get("/net-worth", validate("query", monthsQuery), (c) =>
      c.json(netWorthSeries(deps, c.req.valid("query").months)),
    )
    .get("/monthly", validate("query", monthsQuery), (c) =>
      c.json(monthlySeries(deps, c.req.valid("query").months)),
    )
    .get("/areas", validate("query", dateQuery), (c) =>
      c.json(areaDashboard(deps, c.req.valid("query").date)),
    )
    .get("/subscriptions", (c) => c.json(spotSubscriptions(deps)))
    .get("/weekly-recap", validate("query", dateQuery), (c) =>
      c.json(weeklyRecap(deps, c.req.valid("query").date)),
    );
