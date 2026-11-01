import { type AmountSource, transactionAmount } from "./transaction-amount";

/**
 * Totals for the transactions a filter shows: the summary strip and each day's net.
 * Only transactions in `currency` (the default one) are added up, so amounts in other
 * currencies are never mixed in; they still count. Pure, so it can be tested.
 */

export interface SummaryItem extends AmountSource {
  accountId: string | null;
}

export interface TransactionTotals {
  spentMinor: number;
  earnedMinor: number;
  netMinor: number;
  count: number;
}

export function summarizeTransactions(
  items: SummaryItem[],
  inCurrency: (item: SummaryItem) => boolean,
): TransactionTotals {
  let spentMinor = 0;
  let earnedMinor = 0;
  for (const item of items) {
    if (!inCurrency(item)) continue;
    if (item.type === "expense") spentMinor += Math.abs(item.amountMinor);
    else if (item.type === "income") earnedMinor += Math.abs(item.amountMinor);
  }
  return { spentMinor, earnedMinor, netMinor: earnedMinor - spentMinor, count: items.length };
}

/**
 * A day's net as the list shows it: money in adds, money out takes away. Transfers
 * between your own accounts move nothing, unless the list is seen from one account.
 */
export function dayNet(
  items: SummaryItem[],
  inCurrency: (item: SummaryItem) => boolean,
  perspectiveAccountId?: string,
): number {
  return items.reduce((sum, item) => {
    if (!inCurrency(item)) return sum;
    const amount = transactionAmount(item, perspectiveAccountId);
    if (amount.transfer && !perspectiveAccountId) return sum;
    return sum + amount.minor;
  }, 0);
}
