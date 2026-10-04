import { categoryCreateSchema, categoryUpdateSchema } from "@tick-taka/shared/schemas/money";
import { and, asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { categories } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest } from "../../lib/errors";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";

export const categoryService = (deps: Deps) => {
  const base = crud(deps.db, categories, "Category", deps.now);

  /** Categories are at most two levels deep (Food › Eating out). */
  function assertParent(parentId: string | null | undefined, selfId?: string) {
    if (!parentId) return null;
    if (parentId === selfId) throw badRequest("A category can't be its own parent");
    const parent = base.get(parentId);
    if (parent.parentId) throw badRequest("Categories are at most two levels deep");
    if (selfId) {
      const child = deps.db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.parentId, selfId), isNull(categories.deletedAt)))
        .get();
      if (child) throw badRequest("A category with sub-categories can't move under another");
    }
    return parent;
  }

  return {
    ...base,
    list: () => base.list(undefined, asc(categories.sort)),
    create(input: Parameters<typeof base.create>[0]) {
      const parent = assertParent(input.parentId);
      return base.create({
        ...input,
        parentId: input.parentId ?? null,
        kind: parent?.kind ?? input.kind,
        budgetType: input.budgetType ?? parent?.budgetType ?? "flexible",
        sort: input.sort ?? 0,
      });
    },
    update(id: string, input: Parameters<typeof base.update>[1]) {
      if (input.parentId !== undefined) assertParent(input.parentId, id);
      return base.update(id, input);
    },
  };
};

export const categoriesRoutes = (deps: Deps) => {
  const service = () => categoryService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().list()))
    .post("/", validate("json", categoryCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", categoryUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
