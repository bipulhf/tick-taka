import { createFileRoute, redirect } from "@tanstack/react-router";

/** The spending calendar is Transactions' month view now; old links still land there. */
export const Route = createFileRoute("/_auth/_shell/money/calendar")({
  beforeLoad: () => {
    throw redirect({ to: "/money/transactions", search: { view: "month" }, replace: true });
  },
});
