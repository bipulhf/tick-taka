import { routineCreateSchema, routineUpdateSchema } from "@tick-taka/shared/schemas/time";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { routineService } from "./service";

export const routinesRoutes = (deps: Deps) => {
  const service = () => routineService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().list()))
    .get("/:id", validate("param", idParam), (c) => c.json(service().get(c.req.valid("param").id)))
    .post("/", validate("json", routineCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", routineUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
