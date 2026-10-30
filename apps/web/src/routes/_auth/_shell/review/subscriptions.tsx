import { createFileRoute } from "@tanstack/react-router";
import { SubscriptionsScreen } from "@/features/review/subscriptions-screen";

export const Route = createFileRoute("/_auth/_shell/review/subscriptions")({
  component: SubscriptionsScreen,
});
