import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type BudgetsSearch, validateBudgetsSearch } from "@/features/money/budgets-search";
import { BudgetsView } from "@/features/money/budgets-view";

export const Route = createFileRoute("/_auth/_shell/money/budgets")({
  validateSearch: validateBudgetsSearch,
  component: BudgetsPage,
});

function BudgetsPage() {
  const { plan } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <BudgetsView
      plan={plan}
      onPlan={(month) =>
        void navigate({
          to: ".",
          search: (previous: BudgetsSearch) => ({ ...previous, plan: month }),
        })
      }
    />
  );
}
