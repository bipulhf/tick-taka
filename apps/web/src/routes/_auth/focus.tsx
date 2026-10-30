import { createFileRoute, Link } from "@tanstack/react-router";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/_auth/focus")({
  component: FocusPage,
});

function FocusPage() {
  return (
    <div className="mx-auto max-w-md pt-24">
      <EmptyState message="Focus is on its way." mood="focused" />
      <Link to="/" className="block text-center font-bold text-sky-text">
        Back to Today
      </Link>
    </div>
  );
}
