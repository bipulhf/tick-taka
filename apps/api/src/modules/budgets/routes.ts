import {
  budgetLineParamSchema,
  budgetLinePutSchema,
  budgetMonthQuerySchema,
  budgetsPutSchema,
} from "@tick-taka/shared/schemas/money";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { dateQuery } from "../../lib/params";
import { validate } from "../../lib/validate";
import { budgetMonth, putBudgetLine, putBudgets, safeToSpend } from "./service";

export const budgetsRoutes = (deps: Deps) =>
  new Hono()
    .get("/", validate("query", budgetMonthQuerySchema), (c) =>
      c.json(budgetMonth(deps, c.req.valid("query").month)),
    )
    .put("/", validate("json", budgetsPutSchema), (c) => {
      const { month, budgets } = c.req.valid("json");
      return c.json(putBudgets(deps, month, budgets));
    })
    .put(
      "/:month/:categoryId",
      validate("param", budgetLineParamSchema),
      validate("json", budgetLinePutSchema),
      (c) => {
        const { month, categoryId } = c.req.valid("param");
        return c.json(putBudgetLine(deps, month, categoryId, c.req.valid("json")));
      },
    )
    .get("/safe-to-spend", validate("query", dateQuery), (c) =>
      c.json(safeToSpend(deps, c.req.valid("query").date)),
    );
