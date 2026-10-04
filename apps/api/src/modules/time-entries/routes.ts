import { rangeQuerySchema } from "@tick-taka/shared/schemas/money";
import {
  timeEntryCreateSchema,
  timeEntryListQuerySchema,
  timeEntryUpdateSchema,
  timerStartSchema,
  timerStopSchema,
} from "@tick-taka/shared/schemas/time";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { userTime } from "../../lib/user-time";
import { validate } from "../../lib/validate";
import { timeEntryService } from "./service";

export const timerRoutes = (deps: Deps) => {
  const service = () => timeEntryService(deps);
  return new Hono()
    .get("/", (c) => c.json({ running: service().running() }))
    .post("/start", validate("json", timerStartSchema), (c) =>
      c.json(service().start(c.req.valid("json")), 201),
    )
    .post("/stop", validate("json", timerStopSchema), (c) =>
      c.json(service().stop(c.req.valid("json").endedAt)),
    );
};

export const timeEntriesRoutes = (deps: Deps) => {
  const service = () => timeEntryService(deps);
  return new Hono()
    .get("/", validate("query", timeEntryListQuerySchema), (c) =>
      c.json(service().list(c.req.valid("query"))),
    )
    .get("/focus-stats", validate("query", rangeQuerySchema), (c) => {
      const { from, to } = c.req.valid("query");
      return c.json(service().focusStats({ from, to }, userTime(deps).timeZone));
    })
    .get("/by-area", validate("query", rangeQuerySchema), (c) =>
      c.json(service().minutesByArea(c.req.valid("query"))),
    )
    .post("/", validate("json", timeEntryCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", timeEntryUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
