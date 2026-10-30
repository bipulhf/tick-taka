import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/money/debts")({
  component: DebtsPage,
});

function DebtsPage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Debts" back={{ to: "/money", label: "Money" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
