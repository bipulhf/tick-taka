import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type BudgetsSearch, validateBudgetsSearch } from "@/features/money/budgets-search";
import { BudgetsView } from "@/features/money/budgets-view";
import { PaydayPlan } from "@/features/money/payday-plan";

export const Route = createFileRoute("/_auth/_shell/money/budgets")({
  validateSearch: validateBudgetsSearch,
  component: BudgetsPage,
});

function BudgetsPage() {
  const { plan, split, amount } = Route.useSearch();
  const navigate = useNavigate();
  const go = (patch: Partial<BudgetsSearch>) =>
    void navigate({ to: ".", search: (previous: BudgetsSearch) => ({ ...previous, ...patch }) });
  // Keyed by amount, so a second "Split this" from a toast starts from its own amount.
  if (split) return <PaydayPlan key={amount ?? 0} amount={amount} />;
  return (
    <BudgetsView
      plan={plan}
      onPlan={(month) => go({ plan: month })}
      onSplit={() => go({ split: true, plan: undefined })}
    />
  );
}
