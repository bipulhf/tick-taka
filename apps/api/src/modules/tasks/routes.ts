import {
  moveLowPrioritySchema,
  rescueOverdueSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskUpdateSchema,
} from "@tick-taka/shared/schemas/time";
import { Hono } from "hono";
import type { Deps } from "../../lib/deps";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";
import { moveLowPriority, rescueOverdue } from "./bulk-move";
import { taskService } from "./service";

export const tasksRoutes = (deps: Deps) => {
  const service = () => taskService(deps);
  return new Hono()
    .get("/", validate("query", taskListQuerySchema), (c) =>
      c.json(service().list(c.req.valid("query"))),
    )
    .post("/rescue-overdue", validate("json", rescueOverdueSchema), (c) => {
      const { target, date } = c.req.valid("json");
      return c.json(rescueOverdue(deps, target, date));
    })
    .post("/move-low-priority", validate("json", moveLowPrioritySchema), (c) => {
      const { date, minutesToFree } = c.req.valid("json");
      return c.json(moveLowPriority(deps, date, minutesToFree));
    })
    .get("/:id", validate("param", idParam), (c) => {
      const s = service();
      const task = s.get(c.req.valid("param").id);
      return c.json({ ...task, subtasks: s.list({ parentId: task.id }) });
    })
    .post("/", validate("json", taskCreateSchema), (c) =>
      c.json(service().create(c.req.valid("json")), 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", taskUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
