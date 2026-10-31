import { createFileRoute, redirect } from "@tanstack/react-router";

/** Subscription suggestions moved onto Bills; old links still land there. */
export const Route = createFileRoute("/_auth/_shell/review/subscriptions")({
  beforeLoad: () => {
    throw redirect({ to: "/money/bills", replace: true });
  },
});
