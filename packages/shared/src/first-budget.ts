/**
 * The first budget, asked on the safe-to-spend card as one amount: "Spending money
 * this month". Safe to spend only needs the flexible bucket's total (spending in
 * every flexible category counts against it, budgeted or not), so the amount goes
 * on one line instead of being guessed apart over categories. Budgets is where it
 * gets split up later.
 */

import type { LocalDate } from "./dates";
import { safeToSpendToday } from "./finance";

export interface FirstBudgetCategory {
  id: string;
  parentId: string | null;
  name: string;
  kind: string;
  budgetType: string;
}

/**
 * The category that holds the first budget: the top-level flexible "Other", the
 * catch-all, so no single category (Food, say) looks overspent against a share it
 * never asked for. Without one, the first top-level flexible expense category.
 * Null when there is no flexible expense category at all.
 */
export function firstBudgetCategory(categories: readonly FirstBudgetCategory[]): string | null {
  const flexible = categories.filter(
    (c) => c.parentId === null && c.kind === "expense" && c.budgetType === "flexible",
  );
  const other = flexible.find((c) => c.name.trim().toLowerCase() === "other");
  return (other ?? flexible[0])?.id ?? null;
}

export interface SafeToSpendNumbers {
  dailyMinor: number;
  spentTodayMinor: number;
  leftTodayMinor: number;
  flexibleLeftMinor: number;
  daysLeft: number;
  hasBudgets: boolean;
}

/**
 * Today's safe to spend once a first flexible budget of `limitMinor` is set, by the
 * server's sum, so the card shows the number at once (offline too). With no
 * flexible budget, what is "left" is minus what was spent before today, so the new
 * limit is simply added to it.
 */
export function withFirstBudget(
  money: SafeToSpendNumbers,
  limitMinor: number,
  today: LocalDate,
): SafeToSpendNumbers {
  const flexibleLeftMinor = money.flexibleLeftMinor + limitMinor;
  const dailyMinor = safeToSpendToday(flexibleLeftMinor, today);
  return {
    ...money,
    flexibleLeftMinor,
    dailyMinor,
    leftTodayMinor: dailyMinor - money.spentTodayMinor,
    hasBudgets: money.hasBudgets || limitMinor > 0,
  };
}
