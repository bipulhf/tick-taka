import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/plan/week")({
  component: WeekPage,
});

function WeekPage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Week" back={{ to: "/plan", label: "Plan" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
