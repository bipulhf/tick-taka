import { useLocalSearchParams } from "expo-router";
import { BudgetsScreen } from "@/features/money/budgets-screen";
import { PaydayPlan } from "@/features/money/payday-plan";

/** Budgets; `split=1` is "Split my pay" (the payday plan), `amount` pre-fills what landed. */
export default function Route() {
  const { split, amount, back } = useLocalSearchParams<{
    split?: string;
    amount?: string;
    back?: string;
  }>();
  if (split === "1") {
    const minor = Number(amount);
    return (
      <PaydayPlan
        amount={Number.isSafeInteger(minor) && minor > 0 ? minor : undefined}
        fromBudgets={back === "1"}
      />
    );
  }
  return <BudgetsScreen />;
}
