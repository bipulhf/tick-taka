import { createFileRoute } from "@tanstack/react-router";
import { BudgetsView } from "@/features/money/budgets-view";

export const Route = createFileRoute("/_auth/_shell/money/budgets")({
  component: BudgetsView,
});
