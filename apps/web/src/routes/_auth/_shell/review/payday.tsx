import { createFileRoute, redirect } from "@tanstack/react-router";

/** The payday plan moved into Budgets ("Split my pay"); old links still land there. */
export const Route = createFileRoute("/_auth/_shell/review/payday")({
  beforeLoad: () => {
    throw redirect({ to: "/money/budgets", search: { split: true }, replace: true });
  },
});
