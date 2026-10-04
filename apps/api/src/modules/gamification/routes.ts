import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { gamificationSummary } from "./service";

export const gamificationRoutes = (deps: Deps) =>
  new Hono().get("/", (c) => c.json(gamificationSummary(deps)));
