import { createFileRoute } from "@tanstack/react-router";
import { PaydayPlan } from "@/features/review/payday-plan";

export const Route = createFileRoute("/_auth/_shell/review/payday")({
  component: PaydayPlan,
});
