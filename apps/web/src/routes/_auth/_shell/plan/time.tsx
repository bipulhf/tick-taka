import { createFileRoute } from "@tanstack/react-router";
import { TimeTracking } from "@/features/time/time-tracking";

export const Route = createFileRoute("/_auth/_shell/plan/time")({
  component: TimeTracking,
});
