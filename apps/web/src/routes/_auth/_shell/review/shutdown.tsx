import { createFileRoute } from "@tanstack/react-router";
import { ShutdownFlow } from "@/features/review/shutdown-flow";

export const Route = createFileRoute("/_auth/_shell/review/shutdown")({
  component: ShutdownFlow,
});
