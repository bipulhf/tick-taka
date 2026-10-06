import { newId } from "@tick-taka/shared/ids";
import {
  shoppingCheckoutSchema,
  shoppingItemCreateSchema,
  shoppingItemUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { and, asc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { shoppingItems, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest } from "../../lib/errors";
import { idParam } from "../../lib/params";
import { validate } from "../../lib/validate";

const listQuery = z.object({ list: z.string().max(60).optional() });

/** Priced shopping list: ticking items off at checkout turns them into one expense. */
export const shoppingService = (deps: Deps) => {
  const base = crud(deps.db, shoppingItems, "Shopping item", deps.now);
  const active = (listName?: string) =>
    base.list(
      and(
        isNull(shoppingItems.transactionId),
        listName ? eq(shoppingItems.listName, listName) : undefined,
      ),
      asc(shoppingItems.sort),
    );

  return {
    ...base,
    active,

    lists() {
      const totals = new Map<
        string,
        { listName: string; itemCount: number; estTotalMinor: number; checkedCount: number }
      >();
      for (const item of active()) {
        const entry = totals.get(item.listName) ?? {
          listName: item.listName,
          itemCount: 0,
          estTotalMinor: 0,
          checkedCount: 0,
        };
        entry.itemCount++;
        entry.estTotalMinor += item.estMinor ?? 0;
        if (item.checkedAt) entry.checkedCount++;
        totals.set(item.listName, entry);
      }
      return [...totals.values()];
    },

    checkout(input: z.output<typeof shoppingCheckoutSchema>) {
      // A replay of a checkout that already went through answers with the same result.
      if (input.transactionId) {
        const done = deps.db
          .select()
          .from(transactions)
          .where(eq(transactions.id, input.transactionId))
          .get();
        if (done) {
          const items = deps.db
            .select()
            .from(shoppingItems)
            .where(eq(shoppingItems.transactionId, done.id))
            .all();
          return {
            transactionId: done.id,
            amountMinor: done.amountMinor,
            estimateMinor: items.reduce((sum, item) => sum + (item.estMinor ?? 0), 0),
            items: items.length,
          };
        }
      }
      const checked = base.list(
        and(
          eq(shoppingItems.listName, input.listName),
          isNotNull(shoppingItems.checkedAt),
          isNull(shoppingItems.transactionId),
        ),
      );
      if (checked.length === 0) throw badRequest("Tick at least one item first");
      const estimate = checked.reduce((sum, item) => sum + (item.estMinor ?? 0), 0);
      const amountMinor = input.amountMinor ?? estimate;
      if (amountMinor <= 0) throw badRequest("Enter the total you paid");
      const now = deps.now();
      const transactionId = input.transactionId ?? newId(now);
      deps.db.transaction((tx) => {
        tx.insert(transactions)
          .values({
            id: transactionId,
            type: "expense",
            accountId: input.accountId,
            amountMinor,
            feeMinor: 0,
            categoryId: input.categoryId ?? null,
            eventId: input.eventId ?? null,
            note:
              input.note ??
              `${input.listName}: ${checked.map((item) => item.title).join(", ")}`.slice(0, 2000),
            occurredAt: input.occurredAt ?? now,
            createdAt: now,
            updatedAt: now,
          })
          .run();
        tx.update(shoppingItems)
          .set({ transactionId, updatedAt: now })
          .where(
            inArray(
              shoppingItems.id,
              checked.map((item) => item.id),
            ),
          )
          .run();
      });
      return { transactionId, amountMinor, estimateMinor: estimate, items: checked.length };
    },
  };
};

export const shoppingRoutes = (deps: Deps) => {
  const service = () => shoppingService(deps);
  return new Hono()
    .get("/", validate("query", listQuery), (c) =>
      c.json(service().active(c.req.valid("query").list)),
    )
    .get("/lists", (c) => c.json(service().lists()))
    .post("/", validate("json", shoppingItemCreateSchema), (c) => {
      const input = c.req.valid("json");
      return c.json(
        service().create({
          ...input,
          estMinor: input.estMinor ?? null,
          sort: input.sort ?? 0,
          checkedAt: null,
          transactionId: null,
        }),
        201,
      );
    })
    .patch("/:id", validate("param", idParam), validate("json", shoppingItemUpdateSchema), (c) => {
      const { checked, ...fields } = c.req.valid("json");
      return c.json(
        service().update(c.req.valid("param").id, {
          ...fields,
          ...(checked === undefined ? {} : { checkedAt: checked ? deps.now() : null }),
        }),
      );
    })
    .delete("/:id", validate("param", idParam), (c) =>
      c.json(service().remove(c.req.valid("param").id)),
    )
    .post("/:id/restore", validate("param", idParam), (c) =>
      c.json(service().restore(c.req.valid("param").id)),
    )
    .post("/checkout", validate("json", shoppingCheckoutSchema), (c) =>
      c.json(service().checkout(c.req.valid("json"))),
    );
};
