import { monthOf } from "@tick-taka/shared/dates";
import { debtPayoffForecast } from "@tick-taka/shared/finance";
import { newId } from "@tick-taka/shared/ids";
import type {
  debtCreateSchema,
  debtRepaySchema,
  debtUpdateSchema,
} from "@tick-taka/shared/schemas/money";
import { and, eq, isNull } from "drizzle-orm";
import type { z } from "zod";
import { debts, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";

export type Debt = typeof debts.$inferSelect;
export interface DebtWithBalance extends Debt {
  repaidMinor: number;
  outstandingMinor: number;
}

/**
 * Lending money out is an expense on my account and repayments come back as income;
 * borrowing is the reverse. Both carry the debt_id and stay out of spending reports.
 */
const repaymentType = (direction: Debt["direction"]) =>
  direction === "owed_to_me" ? "income" : "expense";
const openingType = (direction: Debt["direction"]) =>
  direction === "owed_to_me" ? "expense" : "income";

export function debtService(deps: Deps) {
  const base = crud(deps.db, debts, "Debt", deps.now);
  const db = deps.db;

  function withBalance(debt: Debt): DebtWithBalance {
    const repaidMinor = db
      .select({ amount: transactions.amountMinor })
      .from(transactions)
      .where(
        and(
          isNull(transactions.deletedAt),
          eq(transactions.debtId, debt.id),
          eq(transactions.type, repaymentType(debt.direction)),
        ),
      )
      .all()
      .reduce((sum, row) => sum + row.amount, 0);
    return { ...debt, repaidMinor, outstandingMinor: debt.principalMinor - repaidMinor };
  }

  function insertTransaction(values: {
    id?: string | undefined;
    type: "income" | "expense";
    accountId: string;
    amountMinor: number;
    debtId: string;
    note: string;
    occurredAt: number;
  }) {
    const now = deps.now();
    const { id, ...rest } = values;
    db.insert(transactions)
      .values({ id: id ?? newId(now), ...rest, feeMinor: 0, createdAt: now, updatedAt: now })
      .onConflictDoNothing()
      .run();
  }

  const service = {
    ...base,
    listWithBalance: () => base.list().map(withBalance),
    getWithBalance: (id: string) => withBalance(base.get(id)),

    create(input: z.output<typeof debtCreateSchema>): DebtWithBalance {
      return db.transaction(() => {
        const { accountId, occurredAt, ...fields } = input;
        const existed = fields.id ? base.find(fields.id, true) : undefined;
        if (existed) return withBalance(existed);
        const debt = base.create({
          ...fields,
          dueAt: fields.dueAt ?? null,
          remindAt: fields.remindAt ?? null,
          note: fields.note ?? null,
          closedAt: null,
        });
        if (accountId) {
          insertTransaction({
            type: openingType(debt.direction),
            accountId,
            amountMinor: debt.principalMinor,
            debtId: debt.id,
            note:
              debt.direction === "owed_to_me"
                ? `Lent to ${debt.person}`
                : `Borrowed from ${debt.person}`,
            occurredAt: occurredAt ?? deps.now(),
          });
        }
        return withBalance(debt);
      });
    },

    update(id: string, input: z.output<typeof debtUpdateSchema>): DebtWithBalance {
      const { closed, ...fields } = input;
      return withBalance(
        base.update(id, {
          ...fields,
          ...(closed === undefined ? {} : { closedAt: closed ? deps.now() : null }),
        }),
      );
    },

    /** Partial repayment; the debt closes itself once nothing is outstanding. */
    repay(id: string, input: z.output<typeof debtRepaySchema>): DebtWithBalance {
      const debt = base.get(id);
      return db.transaction(() => {
        insertTransaction({
          id: input.id,
          type: repaymentType(debt.direction),
          accountId: input.accountId,
          amountMinor: input.amountMinor,
          debtId: debt.id,
          note: `Repayment · ${debt.person}`,
          occurredAt: input.occurredAt ?? deps.now(),
        });
        const updated = withBalance(debt);
        if (updated.outstandingMinor <= 0 && debt.closedAt === null) {
          return withBalance(base.update(id, { closedAt: deps.now() }));
        }
        return updated;
      });
    },

    /** Debt payoff forecast: the month it clears at a fixed monthly payment. */
    forecast(id: string, monthlyMinor: number) {
      const debt = service.getWithBalance(id);
      return debtPayoffForecast(debt.outstandingMinor, monthlyMinor, monthOf(userTime(deps).today));
    },
  };
  return service;
}
