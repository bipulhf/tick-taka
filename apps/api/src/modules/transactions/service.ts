import type {
  TransactionCreate,
  TransactionListQuery,
  TransactionUpdate,
} from "@tick-taka/shared/schemas/money";
import { and, desc, eq, gte, isNull, like, lt, or, type SQL } from "drizzle-orm";
import { accounts, transactions } from "../../db/schema/money";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest } from "../../lib/errors";
import { categoryRuleService } from "../category-rules/service";

export type Transaction = typeof transactions.$inferSelect;

function encodeCursor(row: Pick<Transaction, "occurredAt" | "id">): string {
  return Buffer.from(`${row.occurredAt}:${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { occurredAt: number; id: string } {
  const [occurredAt, id] = Buffer.from(cursor, "base64url").toString().split(":");
  if (!occurredAt || !id || !Number.isFinite(Number(occurredAt)))
    throw badRequest("Invalid cursor");
  return { occurredAt: Number(occurredAt), id };
}

export function transactionService(deps: Deps) {
  const base = crud(deps.db, transactions, "Transaction", deps.now);
  const db = deps.db;

  function currencyOf(accountId: string): string | undefined {
    return db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, accountId))
      .get()?.currency;
  }

  function checkTransfer(
    values: Pick<Transaction, "type" | "accountId" | "toAccountId" | "toAmountMinor">,
  ) {
    if (values.type !== "transfer") return;
    if (!values.toAccountId) throw badRequest("Pick the account to move money to");
    if (values.toAccountId === values.accountId) throw badRequest("Pick two different accounts");
    const from = currencyOf(values.accountId);
    const to = currencyOf(values.toAccountId);
    if (from && to && from !== to && !values.toAmountMinor) {
      throw badRequest(`Enter how much arrived in ${to}`);
    }
  }

  return {
    ...base,

    list(query: Partial<TransactionListQuery>): {
      items: Transaction[];
      nextCursor: string | null;
    } {
      const filters: (SQL | undefined)[] = [isNull(transactions.deletedAt)];
      if (query.from !== undefined) filters.push(gte(transactions.occurredAt, query.from));
      if (query.to !== undefined) filters.push(lt(transactions.occurredAt, query.to));
      if (query.accountId) {
        filters.push(
          or(
            eq(transactions.accountId, query.accountId),
            eq(transactions.toAccountId, query.accountId),
          ),
        );
      }
      if (query.categoryId) filters.push(eq(transactions.categoryId, query.categoryId));
      if (query.areaId) filters.push(eq(transactions.areaId, query.areaId));
      if (query.eventId) filters.push(eq(transactions.eventId, query.eventId));
      if (query.goalId) filters.push(eq(transactions.goalId, query.goalId));
      if (query.debtId) filters.push(eq(transactions.debtId, query.debtId));
      if (query.type) filters.push(eq(transactions.type, query.type));
      if (query.q)
        filters.push(like(transactions.note, `%${query.q.replace(/[%_]/g, (m) => `\\${m}`)}%`));
      if (query.cursor) {
        const cursor = decodeCursor(query.cursor);
        filters.push(
          or(
            lt(transactions.occurredAt, cursor.occurredAt),
            and(eq(transactions.occurredAt, cursor.occurredAt), lt(transactions.id, cursor.id)),
          ),
        );
      }
      const limit = query.limit ?? 50;
      const rows = db
        .select()
        .from(transactions)
        .where(and(...filters))
        .orderBy(desc(transactions.occurredAt), desc(transactions.id))
        .limit(limit + 1)
        .all();
      const items = rows.slice(0, limit);
      const last = items.at(-1);
      return { items, nextCursor: rows.length > limit && last ? encodeCursor(last) : null };
    },

    create(input: TransactionCreate): Transaction {
      const values = {
        ...input,
        toAccountId: input.toAccountId ?? null,
        toAmountMinor: input.toAmountMinor ?? null,
        categoryId: input.categoryId ?? null,
        areaId: input.areaId ?? null,
        goalId: input.goalId ?? null,
        debtId: input.debtId ?? null,
        eventId: input.eventId ?? null,
        recurringId: input.recurringId ?? null,
        note: input.note ?? null,
        receiptPath: input.receiptPath ?? null,
      };
      if (!(input.id && base.find(input.id, true))) checkTransfer(values);
      return base.create(values);
    },

    /** Changing the category of a noted transaction teaches a rule for next time. */
    update(id: string, input: TransactionUpdate): Transaction {
      const current = base.get(id);
      checkTransfer({
        type: input.type ?? current.type,
        accountId: input.accountId ?? current.accountId,
        toAccountId: input.toAccountId === undefined ? current.toAccountId : input.toAccountId,
        toAmountMinor:
          input.toAmountMinor === undefined ? current.toAmountMinor : input.toAmountMinor,
      });
      const updated = base.update(id, input);
      const categoryChanged =
        input.categoryId !== undefined && input.categoryId !== current.categoryId;
      if (categoryChanged && updated.note && updated.updatedAt !== current.updatedAt) {
        categoryRuleService(deps).learn(updated.note, updated.categoryId, updated.areaId);
      }
      return updated;
    },
  };
}
