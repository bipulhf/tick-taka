import { newId } from "@tick-taka/shared/ids";
import type { accountCreateSchema, accountUpdateSchema } from "@tick-taka/shared/schemas/money";
import { asc, isNull } from "drizzle-orm";
import type { z } from "zod";
import { accounts, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { accountMovements } from "../../lib/money-queries";

export type Account = typeof accounts.$inferSelect;
export type AccountWithBalance = Account & { balanceMinor: number };

export function accountService(deps: Deps) {
  const base = crud(deps.db, accounts, "Account", deps.now);

  const service = {
    ...base,

    /** Accounts with balances computed from the opening balance and every transaction. */
    listWithBalances(includeArchived = false): AccountWithBalance[] {
      const movements = accountMovements(deps.db);
      return base
        .list(includeArchived ? undefined : isNull(accounts.archivedAt), asc(accounts.sort))
        .map((account) => ({
          ...account,
          balanceMinor: account.openingMinor + (movements.get(account.id) ?? 0),
        }));
    },

    balanceOf(accountId: string): number {
      const account = base.get(accountId);
      return account.openingMinor + (accountMovements(deps.db).get(accountId) ?? 0);
    },

    create(input: z.output<typeof accountCreateSchema>): Account {
      return base.create({
        ...input,
        icon: input.icon ?? null,
        sort: input.sort ?? 0,
        archivedAt: null,
      });
    },

    update(id: string, input: z.output<typeof accountUpdateSchema>): Account {
      const { archived, ...fields } = input;
      return base.update(id, {
        ...fields,
        ...(archived === undefined ? {} : { archivedAt: archived ? deps.now() : null }),
      });
    },

    /**
     * Balance check: enter the real balance; the app logs an adjustment for the
     * difference. Returns null when the numbers already match.
     */
    balanceCheck(accountId: string, actualMinor: number, occurredAt?: number, id?: string) {
      const current = service.balanceOf(accountId);
      const difference = actualMinor - current;
      if (difference === 0) return { adjustment: null, balanceMinor: current };
      const now = deps.now();
      const adjustmentId = id ?? newId(now);
      deps.db
        .insert(transactions)
        .values({
          id: adjustmentId,
          type: "adjustment",
          accountId,
          amountMinor: difference,
          feeMinor: 0,
          note: "Balance check",
          occurredAt: occurredAt ?? now,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .run();
      return {
        adjustment: { id: adjustmentId, amountMinor: difference },
        balanceMinor: actualMinor,
      };
    },
  };
  return service;
}
