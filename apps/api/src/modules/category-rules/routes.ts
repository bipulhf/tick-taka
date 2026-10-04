import { categoryRuleCreateSchema } from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { categoryRuleService } from "./service";

export const categoryRulesRoutes = (deps: Deps) => {
  const service = () => categoryRuleService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().list()))
    .post("/", validate("json", categoryRuleCreateSchema), (c) => {
      const { matchText, categoryId, areaId } = c.req.valid("json");
      const s = service();
      const text = s.learn(matchText, categoryId, areaId ?? null);
      return c.json(s.list().find((rule) => rule.matchText === text) ?? null, 201);
    })
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    );
};
