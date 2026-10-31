import { createFileRoute } from "@tanstack/react-router";
import { AiUsageScreen } from "@/features/review/ai-usage-screen";

/** AI cost, opened from Settings › Tiki and AI. */
export const Route = createFileRoute("/_auth/_shell/settings_/ai-cost")({
  component: AiUsageScreen,
});
