import { queryBoolSchema } from "@tick-taka/shared/schemas/common";
import {
  accountCreateSchema,
  accountUpdateSchema,
  balanceCheckSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import { z } from "zod";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { accountService } from "./service";

const listQuery = z.object({ archived: queryBoolSchema.optional() });

export const accountsRoutes = (deps: Deps) => {
  const service = () => accountService(deps);
  return new Hono()
    .get("/", validate("query", listQuery), (c) =>
      c.json(service().listWithBalances(c.req.valid("query").archived)),
    )
    .get("/:id", validate("param", idParam), (c) => {
      const s = service();
      const account = s.get(c.req.valid("param").id);
      return c.json({ ...account, balanceMinor: s.balanceOf(account.id) });
    })
    .post("/", validate("json", accountCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", accountUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .post(
      "/:id/balance-check",
      validate("param", idParam),
      validate("json", balanceCheckSchema),
      (c) => {
        const { actualMinor, occurredAt, id } = c.req.valid("json");
        return c.json(service().balanceCheck(c.req.valid("param").id, actualMinor, occurredAt, id));
      },
    );
};
