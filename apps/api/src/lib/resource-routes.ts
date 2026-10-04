import { Hono } from "hono";
import type { z } from "zod";
import type { crud } from "./crud";
import { idParam } from "./params";
import { validate } from "./validate";

type CrudService = ReturnType<typeof crud>;

/**
 * Standard routes for a simple soft-delete resource:
 * GET /, GET /:id, POST /, PATCH /:id, DELETE /:id, POST /:id/restore.
 */
export function resourceRoutes<
  Service extends CrudService,
  CreateSchema extends z.ZodType,
  UpdateSchema extends z.ZodType,
>(options: {
  service: () => Service;
  createSchema: CreateSchema;
  updateSchema: UpdateSchema;
  toCreate?: (input: z.output<CreateSchema>) => Parameters<Service["create"]>[0];
  toUpdate?: (input: z.output<UpdateSchema>) => Parameters<Service["update"]>[1];
}) {
  const { service, createSchema, updateSchema } = options;
  const toCreate = options.toCreate ?? ((input) => input as Parameters<Service["create"]>[0]);
  const toUpdate = options.toUpdate ?? ((input) => input as Parameters<Service["update"]>[1]);
  type Row = ReturnType<Service["get"]>;

  return new Hono()
    .get("/", (c) => c.json(service().list() as Row[]))
    .get("/:id", validate("param", idParam), (c) =>
      c.json(service().get(c.req.valid("param").id) as Row),
    )
    .post("/", validate("json", createSchema), (c) =>
      c.json(service().create(toCreate(c.req.valid("json") as z.output<CreateSchema>)) as Row, 201),
    )
    .patch("/:id", validate("param", idParam), validate("json", updateSchema), (c) =>
      c.json(
        service().update(
          c.req.valid("param").id,
          toUpdate(c.req.valid("json") as z.output<UpdateSchema>),
        ) as Row,
      ),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id) as Row),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id) as Row),
    );
}
