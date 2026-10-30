import { createFileRoute } from "@tanstack/react-router";
import { AiUsageScreen } from "@/features/review/ai-usage-screen";

export const Route = createFileRoute("/_auth/_shell/review/ai-usage")({
  component: AiUsageScreen,
});
