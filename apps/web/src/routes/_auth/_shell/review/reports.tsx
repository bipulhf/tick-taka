import { createFileRoute } from "@tanstack/react-router";
import { InsightsScreen } from "@/features/review/insights-screen";

export const Route = createFileRoute("/_auth/_shell/review/reports")({
  component: InsightsScreen,
});
