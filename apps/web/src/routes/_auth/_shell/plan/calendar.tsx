import { createFileRoute } from "@tanstack/react-router";
import { CalendarView } from "@/features/plan/calendar-view";

export const Route = createFileRoute("/_auth/_shell/plan/calendar")({
  component: CalendarView,
});
