import { createFileRoute } from "@tanstack/react-router";
import { FocusStats } from "@/features/time/focus-stats";

export const Route = createFileRoute("/_auth/_shell/plan/focus-stats")({
  component: FocusStats,
});
