import { isLocalMonth } from "@tick-taka/shared/dates";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

/** The Budgets view's steps, kept in the URL so a link (or Monthly review) opens one. Pure. */
export interface BudgetsSearch extends PanelSearch {
  /** "Plan next month": the month being planned, "YYYY-MM". */
  plan?: string;
}

export function validateBudgetsSearch(search: Record<string, unknown>): BudgetsSearch {
  const plan =
    typeof search.plan === "string" && isLocalMonth(search.plan) ? search.plan : undefined;
  return { ...validatePanelSearch(search), plan };
}
