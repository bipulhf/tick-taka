import { createFileRoute } from "@tanstack/react-router";
import { BillsView } from "@/features/money/bills-view";

export const Route = createFileRoute("/_auth/_shell/money/bills")({
  component: BillsView,
});
