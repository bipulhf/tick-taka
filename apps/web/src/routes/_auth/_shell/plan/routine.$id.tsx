import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const Route = createFileRoute("/_auth/_shell/plan/routine/$id")({
  component: RoutinePage,
});

function RoutinePage() {
  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Routine" back={{ to: "/plan/routines", label: "Routines" }} />
      <EmptyState message="This view is on its way." mood="focused" />
    </div>
  );
}
