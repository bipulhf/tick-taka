import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/review/subscriptions")({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Subscriptions" back={{ to: "/review", label: "Review" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
