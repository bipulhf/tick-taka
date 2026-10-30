import { createFileRoute } from "@tanstack/react-router";
import { AccountsView } from "@/features/money/accounts-view";

export const Route = createFileRoute("/_auth/_shell/money/accounts")({
  component: AccountsView,
});
