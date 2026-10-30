import { createFileRoute } from "@tanstack/react-router";
import { MonthlyReview } from "@/features/review/monthly-review";

export const Route = createFileRoute("/_auth/_shell/review/monthly")({
  component: MonthlyReview,
});
