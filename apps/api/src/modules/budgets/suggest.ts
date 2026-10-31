import { addMonths, type LocalMonth, localMonthRange } from "@tick-taka/shared/dates";
import { isNull } from "drizzle-orm";
import { categories } from "../../db/schema/money";
import type { Deps } from "../../lib/deps";
import { spendingRows, sumBy } from "../../lib/money-queries";
import { userTime } from "../../lib/user-time";

/** Rounds a suggested limit up to the next ৳100. */
const roundUpTo100Taka = (minor: number) => Math.ceil(minor / 10_000) * 10_000;

/**
 * A month's budgets from the average of the three months before it, one line per
 * top-level category: a sub-category's spending counts in its parent's, as budgets
 * count it, and the editor only shows parents.
 */
export function suggestBudgets(deps: Deps, month: LocalMonth) {
  const { timeZone } = userTime(deps);
  const parentOf = new Map(
    deps.db
      .select({ id: categories.id, parentId: categories.parentId })
      .from(categories)
      .where(isNull(categories.deletedAt))
      .all()
      .map((c) => [c.id, c.parentId]),
  );
  /** The top-level category, or null for no category or a deleted one. */
  const topLevel = (id: string | null) => {
    if (!id || !parentOf.has(id)) return null;
    return parentOf.get(id) ?? id;
  };
  const totals = new Map<string | null, number>();
  for (let i = 1; i <= 3; i++) {
    const rows = spendingRows(deps.db, localMonthRange(addMonths(month, -i), timeZone));
    for (const [categoryId, amount] of sumBy(
      rows,
      (r) => topLevel(r.categoryId),
      (r) => r.amountMinor,
    )) {
      totals.set(categoryId, (totals.get(categoryId) ?? 0) + amount);
    }
  }
  return [...totals.entries()]
    .filter((entry): entry is [string, number] => entry[0] !== null)
    .map(([categoryId, total]) => ({ categoryId, limitMinor: roundUpTo100Taka(total / 3) }))
    .filter((line) => line.limitMinor > 0)
    .sort((a, b) => b.limitMinor - a.limitMinor);
}
