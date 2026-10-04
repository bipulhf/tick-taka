import { eventCreateSchema, eventUpdateSchema } from "@tick-taka/shared/schemas/money";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { events, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { spendingRows } from "../../lib/money-queries";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";

type Event = typeof events.$inferSelect;

/** Events (a trip, Eid) collect spending from every account under one budget. */
export const eventService = (deps: Deps) => {
  const base = crud(deps.db, events, "Event", deps.now);
  const withSpending = (event: Event) => {
    const rows = spendingRows(
      deps.db,
      { from: 0, to: Number.MAX_SAFE_INTEGER },
      eq(transactions.eventId, event.id),
    );
    const spentMinor = rows.reduce((sum, row) => sum + row.amountMinor, 0);
    return {
      ...event,
      spentMinor,
      transactionCount: rows.length,
      leftMinor: event.budgetMinor === null ? null : event.budgetMinor - spentMinor,
    };
  };
  return {
    ...base,
    listWithSpending: () => base.list(undefined, desc(events.startsOn)).map(withSpending),
    getWithSpending: (id: string) => withSpending(base.get(id)),
  };
};

export const eventsRoutes = (deps: Deps) => {
  const service = () => eventService(deps);
  return new Hono()
    .get("/", (c) => c.json(service().listWithSpending()))
    .get("/:id", validate("param", idParam), (c) =>
      c.json(service().getWithSpending(c.req.valid("param").id)),
    )
    .post("/", validate("json", eventCreateSchema), (c) => {
      const input = c.req.valid("json");
      return c.json(service().create({ ...input, budgetMinor: input.budgetMinor ?? null }), 201);
    })
    .patch("/:id", validate("param", idParam), validate("json", eventUpdateSchema), (c) =>
      c.json(service().update(c.req.valid("param").id, c.req.valid("json"))),
    )
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    );
};
