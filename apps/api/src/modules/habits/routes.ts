import { idSchema, localDateSchema, queryBoolSchema } from "@tick-taka/shared/schemas/common";
import {
  habitCreateSchema,
  habitLogPutSchema,
  habitUpdateSchema,
} from "@tick-taka/shared/schemas/time";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { habitService } from "./service";

const listQuery = z.object({
  date: localDateSchema.optional(),
  archived: queryBoolSchema.optional(),
});
const logParam = z.object({ id: idSchema, date: localDateSchema });
const logsQuery = z.object({ from: localDateSchema, to: localDateSchema });

export const habitsRoutes = (deps: Deps) => {
  const service = () => habitService(deps);
  return new Hono()
    .get("/", validate("query", listQuery), (c) => {
      const { date, archived } = c.req.valid("query");
      return c.json(service().listWithProgress(date, archived ?? false));
    })
    .post("/", validate("json", habitCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", habitUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .get("/:id/logs", validate("param", idParam), validate("query", logsQuery), (c) => {
      const { from, to } = c.req.valid("query");
      return c.json(service().logs(c.req.valid("param").id, from, to));
    })
    .put(
      "/:id/logs/:date",
      validate("param", logParam),
      validate("json", habitLogPutSchema),
      (c) => {
        const { id, date } = c.req.valid("param");
        return c.json(service().setLog(id, date, c.req.valid("json").count));
      },
    );
};
