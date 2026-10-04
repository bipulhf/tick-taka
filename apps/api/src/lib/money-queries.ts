/**
 * Read-only money aggregates. Balances and totals are always computed from
 * transactions, never stored, so they can't drift out of sync.
 */

import type { InstantRange } from "@tick-taka/shared/dates";
import { and, eq, gte, isNull, lt, type SQL, sql } from "drizzle-orm";
import type { Db } from "../db/client";
import { categories, transactions } from "../db/schema/money";

/** Signed effect of each transaction on its source account. */
const sourceEffect = sql<number>`case ${transactions.type}
  when 'expense' then -${transactions.amountMinor} - ${transactions.feeMinor}
  when 'income' then ${transactions.amountMinor} - ${transactions.feeMinor}
  when 'transfer' then -${transactions.amountMinor} - ${transactions.feeMinor}
  else ${transactions.amountMinor} end`;

/** Net movement per account from transactions (opening balances not included). */
export function accountMovements(db: Db, before?: number): Map<string, number> {
  const timeFilter = before === undefined ? undefined : lt(transactions.occurredAt, before);
  const totals = new Map<string, number>();
  const outgoing = db
    .select({
      accountId: transactions.accountId,
      total: sql<number>`coalesce(sum(${sourceEffect}), 0)`,
    })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), timeFilter))
    .groupBy(transactions.accountId)
    .all();
  for (const row of outgoing) totals.set(row.accountId, Number(row.total));
  const incoming = db
    .select({
      accountId: transactions.toAccountId,
      total: sql<number>`coalesce(sum(coalesce(${transactions.toAmountMinor}, ${transactions.amountMinor})), 0)`,
    })
    .from(transactions)
    .where(and(isNull(transactions.deletedAt), eq(transactions.type, "transfer"), timeFilter))
    .groupBy(transactions.toAccountId)
    .all();
  for (const row of incoming) {
    if (row.accountId)
      totals.set(row.accountId, (totals.get(row.accountId) ?? 0) + Number(row.total));
  }
  return totals;
}

export interface SpendingRow {
  categoryId: string | null;
  areaId: string | null;
  eventId: string | null;
  occurredAt: number;
  amountMinor: number;
  accountId: string;
}

/**
 * Every taka that counts as spending in a range: expenses (excluding money set aside
 * for goals and lent out as debts) plus fees on transfers such as a bKash cash-out.
 */
export function spendingRows(db: Db, range: InstantRange, extra?: SQL): SpendingRow[] {
  const rows = db
    .select({
      type: transactions.type,
      categoryId: transactions.categoryId,
      areaId: transactions.areaId,
      eventId: transactions.eventId,
      occurredAt: transactions.occurredAt,
      amountMinor: transactions.amountMinor,
      feeMinor: transactions.feeMinor,
      goalId: transactions.goalId,
      debtId: transactions.debtId,
      accountId: transactions.accountId,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        gte(transactions.occurredAt, range.from),
        lt(transactions.occurredAt, range.to),
        extra,
      ),
    )
    .all();
  const feeCategory = feesCategoryId(db);
  const result: SpendingRow[] = [];
  for (const row of rows) {
    const base = {
      areaId: row.areaId,
      eventId: row.eventId,
      occurredAt: row.occurredAt,
      accountId: row.accountId,
    };
    if (row.type === "expense" && row.goalId === null && row.debtId === null) {
      result.push({
        ...base,
        categoryId: row.categoryId,
        amountMinor: row.amountMinor + row.feeMinor,
      });
    } else if (row.feeMinor > 0 && row.type !== "adjustment") {
      result.push({
        ...base,
        categoryId: row.type === "transfer" ? feeCategory : row.categoryId,
        amountMinor: row.feeMinor,
      });
    }
  }
  return result;
}

export interface IncomeRow {
  categoryId: string | null;
  areaId: string | null;
  occurredAt: number;
  amountMinor: number;
}

/** Income in a range, excluding debt repayments and borrowing. */
export function incomeRows(db: Db, range: InstantRange): IncomeRow[] {
  return db
    .select({
      categoryId: transactions.categoryId,
      areaId: transactions.areaId,
      occurredAt: transactions.occurredAt,
      amountMinor: transactions.amountMinor,
    })
    .from(transactions)
    .where(
      and(
        isNull(transactions.deletedAt),
        eq(transactions.type, "income"),
        isNull(transactions.debtId),
        gte(transactions.occurredAt, range.from),
        lt(transactions.occurredAt, range.to),
      ),
    )
    .all();
}

function feesCategoryId(db: Db): string | null {
  return (
    db
      .select({ id: categories.id })
      .from(categories)
      .where(and(isNull(categories.deletedAt), eq(categories.name, "Fees & charges")))
      .get()?.id ?? null
  );
}

export function sumBy<T>(
  rows: T[],
  key: (row: T) => string | null,
  value: (row: T) => number,
): Map<string | null, number> {
  const totals = new Map<string | null, number>();
  for (const row of rows) totals.set(key(row), (totals.get(key(row)) ?? 0) + value(row));
  return totals;
}
