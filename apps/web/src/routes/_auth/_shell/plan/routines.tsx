import { createFileRoute } from "@tanstack/react-router";
import { RoutineList } from "@/features/routines/routine-list";

export const Route = createFileRoute("/_auth/_shell/plan/routines")({
  component: RoutineList,
});
