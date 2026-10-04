import {
  transactionCreateSchema,
  transactionListQuerySchema,
  transactionUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { transactionService } from "./service";

export const transactionsRoutes = (deps: Deps) => {
  const service = () => transactionService(deps);
  return new Hono()
    .get("/", validate("query", transactionListQuerySchema), (c) =>
      c.json(service().list(c.req.valid("query"))),
    )
    .get("/:id", validate("param", idParam), (c) => c.json(service().get(c.req.valid("param").id)))
    .post("/", validate("json", transactionCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", transactionUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
