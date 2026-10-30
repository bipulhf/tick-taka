import { createFileRoute } from "@tanstack/react-router";
import { GoalsView } from "@/features/money/goals-view";

export const Route = createFileRoute("/_auth/_shell/money/goals")({
  component: GoalsView,
});
