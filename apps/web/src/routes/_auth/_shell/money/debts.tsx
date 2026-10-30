import { createFileRoute } from "@tanstack/react-router";
import { DebtsView } from "@/features/money/debts-view";

export const Route = createFileRoute("/_auth/_shell/money/debts")({
  component: DebtsView,
});
