import { createFileRoute } from "@tanstack/react-router";
import { WeeklyReview } from "@/features/review/weekly-review";

export const Route = createFileRoute("/_auth/_shell/review/weekly")({
  component: WeeklyReview,
});
