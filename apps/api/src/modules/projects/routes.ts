import {
  projectCreateSchema,
  projectListQuerySchema,
  projectUpdateSchema,
} from "@tick-taka/shared/schemas/time";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { Hono } from "hono";
import { projects } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";

export const projectsRoutes = (deps: Deps) => {
  const service = () => crud(deps.db, projects, "Project", deps.now);
  return new Hono()
    .get("/", validate("query", projectListQuerySchema), (c) => {
      const query = c.req.valid("query");
      const filters: SQL[] = [];
      if (query.areaId) filters.push(eq(projects.areaId, query.areaId));
      if (query.status) filters.push(eq(projects.status, query.status));
      return c.json(service().list(and(...filters), asc(projects.sort)));
    })
    .get("/:id", validate("param", idParam), (c) => c.json(service().get(c.req.valid("param").id)))
    .post("/", validate("json", projectCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", projectUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
