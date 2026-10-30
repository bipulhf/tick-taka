import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoutineRunner } from "@/features/routines/routine-runner";
import { type PanelSearch, validatePanelSearch } from "@/lib/panel";

interface RoutineSearch extends PanelSearch {
  /** Opens straight into editing its steps, as after adding a routine. */
  edit?: boolean;
}

export const Route = createFileRoute("/_auth/_shell/plan/routine/$id")({
  validateSearch: (search: Record<string, unknown>): RoutineSearch => ({
    ...validatePanelSearch(search),
    edit: search.edit === true || search.edit === "true" || search.edit === "1" ? true : undefined,
  }),
  component: RoutinePage,
});

function RoutinePage() {
  const { id } = Route.useParams();
  const { edit } = Route.useSearch();
  const navigate = useNavigate();
  return (
    <RoutineRunner
      key={id}
      id={id}
      editing={Boolean(edit)}
      onEditingChange={(editing) =>
        void navigate({
          to: ".",
          search: (previous: RoutineSearch) => ({ ...previous, edit: editing || undefined }),
          replace: true,
        })
      }
    />
  );
}
