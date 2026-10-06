import {
  addDays,
  DAY_MS,
  localParts,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { formatAmount, minorFactor } from "@tick-taka/shared/money";
import { nextOccurrence } from "@tick-taka/shared/recurrence";
import type {
  recurringCreateSchema,
  recurringPaySchema,
  recurringUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { and, asc, eq, isNull, lt } from "drizzle-orm";
import type { z } from "zod";
import { accounts, recurring, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest, conflict } from "../../lib/errors";
import { userTime } from "../../lib/user-time";

export type Recurring = typeof recurring.$inferSelect;
export type RecurringStatus = "overdue" | "due_today" | "due_soon" | "upcoming";

export interface RecurringWithStatus extends Recurring {
  status: RecurringStatus;
  dueDate: string;
}

/** Converts an amount between currencies at `rate` (target units per one source unit). */
export function convertMinor(
  amountMinor: number,
  fromCurrency: string,
  toCurrency: string,
  rate: number,
): number {
  return Math.round((amountMinor / minorFactor(fromCurrency)) * rate * minorFactor(toCurrency));
}

export function recurringService(deps: Deps) {
  const base = crud(deps.db, recurring, "Recurring item", deps.now);
  const db = deps.db;

  function withStatus(item: Recurring, timeZone: string, today: string): RecurringWithStatus {
    const dueDate = toLocalDate(item.nextDueAt, timeZone);
    let status: RecurringStatus = "upcoming";
    if (dueDate < today) status = "overdue";
    else if (dueDate === today) status = "due_today";
    else if (dueDate <= addDays(today, item.remindDays)) status = "due_soon";
    return { ...item, status, dueDate };
  }

  /** Next due instant after `current`, keeping the time of day. */
  function advance(item: Recurring, timeZone: string): number {
    const dueDate = toLocalDate(item.nextDueAt, timeZone);
    const next = nextOccurrence(item.rrule, dueDate, dueDate);
    if (!next) throw badRequest("This repeat rule has no next date");
    const { hour, minute } = localParts(item.nextDueAt, timeZone);
    const [year, month, day] = next.split("-").map(Number) as [number, number, number];
    return zonedTimeToUtc({ year, month, day, hour, minute }, timeZone);
  }

  return {
    ...base,

    listWithStatus(): RecurringWithStatus[] {
      const { timeZone, today } = userTime(deps);
      return base
        .list(eq(recurring.active, true), asc(recurring.nextDueAt))
        .map((item) => withStatus(item, timeZone, today));
    },

    create(input: z.output<typeof recurringCreateSchema>): Recurring {
      return base.create({
        ...input,
        accountId: input.accountId ?? null,
        categoryId: input.categoryId ?? null,
        areaId: input.areaId ?? null,
        active: true,
        overdueAt: null,
      });
    },

    update(id: string, input: z.output<typeof recurringUpdateSchema>): Recurring {
      return base.update(id, input.nextDueAt === undefined ? input : { ...input, overdueAt: null });
    },

    /**
     * "Paid" or "Received": logs the transaction and moves next_due_at forward.
     * Foreign-currency income is converted at the rate I enter.
     */
    pay(id: string, input: z.output<typeof recurringPaySchema>) {
      const item = base.get(id);
      const { timeZone, settings } = userTime(deps);
      return db.transaction(() => {
        // Replays (lost response, double tap, outbox retry) return the state as it is.
        if (input.transactionId) {
          const logged = db
            .select()
            .from(transactions)
            .where(eq(transactions.id, input.transactionId))
            .get();
          if (logged) {
            if (logged.recurringId !== item.id) throw conflict("That transaction id is taken");
            return { transaction: logged, recurring: item };
          }
        }
        if (input.dueAt !== undefined && input.dueAt < item.nextDueAt)
          return { transaction: null, recurring: item };
        let transaction: typeof transactions.$inferSelect | null = null;
        if (!input.skip) {
          const accountId = input.accountId ?? item.accountId ?? settings.defaultAccountId;
          if (!accountId) throw badRequest("Pick the account this was paid from");
          const account = db.select().from(accounts).where(eq(accounts.id, accountId)).get();
          if (!account) throw badRequest("That account doesn't exist");
          const planned = input.amountMinor ?? item.amountMinor;
          let amountMinor = planned;
          let note = item.name;
          if (account.currency !== item.currency) {
            if (input.receivedMinor) amountMinor = input.receivedMinor;
            else if (input.rate)
              amountMinor = convertMinor(planned, item.currency, account.currency, input.rate);
            else
              throw badRequest(
                `Enter the ${item.currency} → ${account.currency} rate or the amount received`,
              );
            const rate =
              input.rate ??
              amountMinor / minorFactor(account.currency) / (planned / minorFactor(item.currency));
            note = `${item.name} · ${formatAmount(planned, { currency: item.currency })} @ ${rate.toFixed(2)}`;
          }
          const now = deps.now();
          const transactionId = input.transactionId ?? newId(now);
          db.insert(transactions)
            .values({
              id: transactionId,
              type: item.kind === "bill" ? "expense" : "income",
              accountId,
              amountMinor,
              feeMinor: 0,
              categoryId: item.categoryId,
              areaId: item.areaId,
              recurringId: item.id,
              note,
              occurredAt: input.occurredAt ?? now,
              createdAt: now,
              updatedAt: now,
            })
            .run();
          transaction =
            db.select().from(transactions).where(eq(transactions.id, transactionId)).get() ?? null;
        }
        const updated = base.update(id, { nextDueAt: advance(item, timeZone), overdueAt: null });
        return { transaction, recurring: updated };
      });
    },

    /** Midnight job: flags bills whose due date passed unpaid. */
    markOverdue(): number {
      const { timeZone, today, settings } = userTime(deps);
      const cutoff = startOfLocalDay(today, timeZone) - settings.billOverdueGraceDays * DAY_MS;
      const now = deps.now();
      const result = db
        .update(recurring)
        .set({ overdueAt: now, updatedAt: now })
        .where(
          and(
            isNull(recurring.deletedAt),
            isNull(recurring.overdueAt),
            eq(recurring.active, true),
            eq(recurring.kind, "bill"),
            lt(recurring.nextDueAt, cutoff),
          ),
        )
        .returning({ id: recurring.id })
        .all();
      return result.length;
    },
  };
}
