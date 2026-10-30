import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/review/monthly")({
  component: MonthlyReviewPage,
});

function MonthlyReviewPage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Monthly review" back={{ to: "/review", label: "Review" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
