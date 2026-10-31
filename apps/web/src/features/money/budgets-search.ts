import { isLocalMonth } from "@tick-taka/shared/dates";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

/** The Budgets view's steps, kept in the URL so a link (or a toast) opens one. Pure. */
export interface BudgetsSearch extends PanelSearch {
  /** "Plan next month": the month being planned, "YYYY-MM". */
  plan?: string;
  /** "Split my pay": the payday plan. */
  split?: true;
  /** What landed, in minor units, to pre-fill the split. */
  amount?: number;
}

export function validateBudgetsSearch(search: Record<string, unknown>): BudgetsSearch {
  const plan =
    typeof search.plan === "string" && isLocalMonth(search.plan) ? search.plan : undefined;
  const split = search.split === true || search.split === "true" || search.split === 1;
  const amount = Number(search.amount);
  return {
    ...validatePanelSearch(search),
    plan,
    split: split ? true : undefined,
    amount: split && Number.isSafeInteger(amount) && amount > 0 ? amount : undefined,
  };
}
