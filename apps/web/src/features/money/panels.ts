import type { PanelRegistry } from "../panel-types";
import { AccountPanel } from "./account-panel";
import { BudgetPanel } from "./budget-panel";
import { CategoryPanel } from "./category-panel";
import { DebtPanel } from "./debt-panel";
import { EventPanel } from "./event-panel";
import { GoalPanel } from "./goal-panel";
import { RecurringPanel } from "./recurring-panel";
import { ShoppingItemPanel } from "./shopping-item-panel";
import { TransactionPanel } from "./transaction-panel";

/** This area's edit panels, by the kind in `?panel=<kind>:<id>`. */
export const moneyPanels: PanelRegistry = {
  transaction: TransactionPanel,
  account: AccountPanel,
  budget: BudgetPanel,
  recurring: RecurringPanel,
  category: CategoryPanel,
  goal: GoalPanel,
  debt: DebtPanel,
  event: EventPanel,
  "shopping-item": ShoppingItemPanel,
};
