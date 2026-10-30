import { createFileRoute } from "@tanstack/react-router";
import { MoneyOverview } from "@/features/money/money-overview";

export const Route = createFileRoute("/_auth/_shell/money/")({
  component: MoneyOverview,
});
