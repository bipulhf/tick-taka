import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/money/shopping")({
  component: ShoppingPage,
});

function ShoppingPage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Shopping" back={{ to: "/money", label: "Money" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
