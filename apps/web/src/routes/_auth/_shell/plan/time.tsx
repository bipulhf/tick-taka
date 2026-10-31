import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FocusStats } from "@/features/time/focus-stats";
import { type TimeView, validateTimeSearch } from "@/features/time/time-search";
import { TimeTracking } from "@/features/time/time-tracking";

export const Route = createFileRoute("/_auth/_shell/plan/time")({
  validateSearch: validateTimeSearch,
  component: TimePage,
});

function TimePage() {
  const { view } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const onView = (next: TimeView) =>
    void navigate({
      search: (previous) => ({ ...previous, view: next === "focus" ? "focus" : undefined }),
      replace: true,
    });
  return view === "focus" ? <FocusStats onView={onView} /> : <TimeTracking onView={onView} />;
}
