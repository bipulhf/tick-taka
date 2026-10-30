import { createFileRoute } from "@tanstack/react-router";
import { FocusView } from "@/features/focus/focus-view";

export interface FocusSearch {
  /** The task to focus on, as the phone's `/focus?taskId=`. */
  taskId?: string;
  /** Where Back and Escape go; history, or Today, otherwise. */
  from?: string;
}

export const Route = createFileRoute("/_auth/focus")({
  validateSearch: (search: Record<string, unknown>): FocusSearch => ({
    taskId: typeof search.taskId === "string" && search.taskId ? search.taskId : undefined,
    from: typeof search.from === "string" && search.from.startsWith("/") ? search.from : undefined,
  }),
  component: FocusPage,
});

function FocusPage() {
  const { taskId, from } = Route.useSearch();
  return <FocusView taskId={taskId} from={from} />;
}
