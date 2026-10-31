import { createFileRoute, redirect } from "@tanstack/react-router";

/** AI cost lives under Settings now; old links still land there. */
export const Route = createFileRoute("/_auth/_shell/review/ai-usage")({
  beforeLoad: () => {
    throw redirect({ to: "/settings/ai-cost", replace: true });
  },
});
