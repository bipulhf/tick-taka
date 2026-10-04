import { settingsPatchSchema } from "@tick-taka/shared/schemas/settings";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { validate } from "../../lib/validate";
import { readSettings, writeSettings } from "./service";

export const settingsRoutes = (deps: Deps) =>
  new Hono()
    .get("/", (c) => c.json(readSettings(deps.db)))
    .patch("/", validate("json", settingsPatchSchema), (c) =>
      c.json(writeSettings(deps.db, c.req.valid("json"), deps.now())),
    );
