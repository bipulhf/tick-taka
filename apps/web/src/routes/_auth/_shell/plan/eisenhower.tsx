import { createFileRoute } from "@tanstack/react-router";
import { EisenhowerGrid } from "@/features/plan/eisenhower-grid";

export const Route = createFileRoute("/_auth/_shell/plan/eisenhower")({
  component: EisenhowerGrid,
});
