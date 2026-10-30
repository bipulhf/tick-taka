import { createFileRoute } from "@tanstack/react-router";
import { SomedayList } from "@/features/plan/someday-list";

export const Route = createFileRoute("/_auth/_shell/plan/someday")({
  component: SomedayList,
});
