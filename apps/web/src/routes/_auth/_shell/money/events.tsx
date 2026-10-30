import { createFileRoute } from "@tanstack/react-router";
import { EventsView } from "@/features/money/events-view";

export const Route = createFileRoute("/_auth/_shell/money/events")({
  component: EventsView,
});
