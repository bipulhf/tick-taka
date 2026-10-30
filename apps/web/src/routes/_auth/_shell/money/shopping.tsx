import { createFileRoute } from "@tanstack/react-router";
import { ShoppingView } from "@/features/money/shopping-view";

export const Route = createFileRoute("/_auth/_shell/money/shopping")({
  component: ShoppingView,
});
