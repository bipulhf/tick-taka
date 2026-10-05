import { toLocalDate } from "@tick-taka/shared/dates";
import type { TodayData } from "./queries";

interface Category {
  id: string;
  parentId: string | null;
  budgetType: string;
}

export interface NewExpense {
  amountMinor: number;
  categoryId?: string | null;
  occurredAt: number;
}

/**
 * Whether an expense counts against today's safe-to-spend, by the server's rule:
 * uncategorised, or under a top-level category whose budget type is flexible.
 */
function countsAsFlexible(categoryId: string | null | undefined, categories: Category[]) {
  if (!categoryId) return true;
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return false;
  const top = category.parentId
    ? (categories.find((c) => c.id === category.parentId) ?? category)
    : category;
  return top.budgetType === "flexible";
}

/**
 * Today's safe-to-spend with a just-logged expense taken off, so the number moves
 * the moment you save, even offline. The next server refresh replaces it.
 */
export function withNewExpense(
  data: TodayData,
  expense: NewExpense,
  categories: Category[],
  timeZone: string,
): TodayData {
  const money = data.safeToSpend;
  if (!money.hasBudgets || toLocalDate(expense.occurredAt, timeZone) !== data.date) return data;
  if (!countsAsFlexible(expense.categoryId, categories)) return data;
  return {
    ...data,
    safeToSpend: {
      ...money,
      spentTodayMinor: money.spentTodayMinor + expense.amountMinor,
      leftTodayMinor: money.leftTodayMinor - expense.amountMinor,
    },
  };
}
