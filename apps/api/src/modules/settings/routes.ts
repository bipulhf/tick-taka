import { addDays } from "@tick-taka/shared/dates";
import { type SettingsPatch, settingsPatchSchema } from "@tick-taka/shared/schemas/settings";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { readSettings, writeSettings } from "./service";

export const settingsRoutes = (deps: Deps) =>
  new Hono()
    .get("/", (c) => c.json(readSettings(deps.db)))
    .patch("/", validate("json", settingsPatchSchema), (c) => {
      const patch: SettingsPatch = { ...c.req.valid("json") };
      const { settings, today } = userTime(deps);
      // Toggling vacation mode opens or closes a vacation period.
      if (
        patch.vacationMode !== undefined &&
        patch.vacationMode !== settings.vacationMode &&
        !patch.vacations
      ) {
        const periods = settings.vacations.filter((p) => p.to !== null);
        patch.vacations = patch.vacationMode
          ? [...periods, { from: today, to: null }]
          : [
              ...periods,
              ...settings.vacations
                .filter((p) => p.to === null)
                .map((p) => ({
                  from: p.from,
                  to: p.from > addDays(today, -1) ? p.from : addDays(today, -1),
                })),
            ];
      }
      return c.json(writeSettings(deps.db, patch, deps.now()));
    });
