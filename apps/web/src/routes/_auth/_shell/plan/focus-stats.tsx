import { createFileRoute, redirect } from "@tanstack/react-router";

/** Focus statistics is Time's Focus only view now; old links still land there. */
export const Route = createFileRoute("/_auth/_shell/plan/focus-stats")({
  beforeLoad: () => {
    throw redirect({ to: "/plan/time", search: { view: "focus" }, replace: true });
  },
});
