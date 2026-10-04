import {
  goalContributeSchema,
  goalCreateSchema,
  goalUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { goalService } from "./service";

export const goalsRoutes = (deps: Deps) => {
  const service = () => goalService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().listWithProgress()))
    .get("/:id", validate("param", idParam), (c) =>
      c.json(service().getWithProgress(c.req.valid("param").id)),
    )
    .post("/", validate("json", goalCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", goalUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .post(
      "/:id/contribute",
      validate("param", idParam),
      validate("json", goalContributeSchema),
      (c) => c.json(service().contribute(c.req.valid("param").id, c.req.valid("json"))),
    );
};
