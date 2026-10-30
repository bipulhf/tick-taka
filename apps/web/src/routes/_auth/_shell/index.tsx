import { createFileRoute } from "@tanstack/react-router";
import { TodayView } from "@/features/today/today-view";

export const Route = createFileRoute("/_auth/_shell/")({
  component: TodayView,
});
