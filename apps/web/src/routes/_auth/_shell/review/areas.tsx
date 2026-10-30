import { createFileRoute } from "@tanstack/react-router";
import { AreaDashboard } from "@/features/review/area-dashboard";

export const Route = createFileRoute("/_auth/_shell/review/areas")({
  component: AreaDashboard,
});
