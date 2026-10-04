import {
  debtCreateSchema,
  debtForecastQuerySchema,
  debtRepaySchema,
  debtUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { debtService } from "./service";

export const debtsRoutes = (deps: Deps) => {
  const service = () => debtService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().listWithBalance()))
    .get("/:id", validate("param", idParam), (c) =>
      c.json(service().getWithBalance(c.req.valid("param").id)),
    )
    .get(
      "/:id/forecast",
      validate("param", idParam),
      validate("query", debtForecastQuerySchema),
      (c) => c.json(service().forecast(c.req.valid("param").id, c.req.valid("query").monthly)),
    )
    .post("/", validate("json", debtCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", debtUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .post("/:id/repay", validate("param", idParam), validate("json", debtRepaySchema), (c) =>
      c.json(service().repay(c.req.valid("param").id, c.req.valid("json"))),
    );
};
