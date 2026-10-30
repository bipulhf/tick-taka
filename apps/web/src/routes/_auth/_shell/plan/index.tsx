import { createFileRoute } from "@tanstack/react-router";
import { PlanHome } from "@/features/plan/plan-home";

export const Route = createFileRoute("/_auth/_shell/plan/")({
  component: PlanHome,
});
