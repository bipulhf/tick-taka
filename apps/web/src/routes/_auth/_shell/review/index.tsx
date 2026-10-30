import { createFileRoute } from "@tanstack/react-router";
import { ReviewHome } from "@/features/review/review-home";

export const Route = createFileRoute("/_auth/_shell/review/")({
  component: ReviewHome,
});
