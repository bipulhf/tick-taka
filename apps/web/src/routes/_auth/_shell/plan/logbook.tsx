import { createFileRoute } from "@tanstack/react-router";
import { LogbookList } from "@/features/plan/logbook-list";

export const Route = createFileRoute("/_auth/_shell/plan/logbook")({
  component: LogbookList,
});
