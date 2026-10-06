import {
  recurringCreateSchema,
  recurringPaySchema,
  recurringUnpaySchema,
  recurringUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { recurringService } from "./service";

export const recurringRoutes = (deps: Deps) => {
  const service = () => recurringService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().listWithStatus()))
    .get("/:id", validate("param", idParam), (c) => c.json(service().get(c.req.valid("param").id)))
    .post("/", validate("json", recurringCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", recurringUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .post("/:id/pay", validate("param", idParam), validate("json", recurringPaySchema), (c) =>
      c.json(service().pay(c.req.valid("param").id, c.req.valid("json"))),
    )
    .post("/:id/unpay", validate("param", idParam), validate("json", recurringUnpaySchema), (c) =>
      c.json(service().unpay(c.req.valid("param").id, c.req.valid("json"))),
    );
};
