import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { patchTaskCaches } from "@/features/tasks/use-task-actions";
import { useSettings } from "@/lib/queries";
import { focusQuickAdd } from "@/lib/ui-state";
import { fire } from "@/lib/write";
import { CompactTask } from "./compact-task";
import { Draggable, DropArea, PlanDnd } from "./plan-dnd";
import { QUADRANTS, quadrantChange } from "./quadrants";
import { useTasks } from "./queries";

/** Drag tasks into the urgent/important grid to decide what to drop. */
export function EisenhowerGrid() {
  const client = useQueryClient();
  const { data: settings } = useSettings();
  const tasks = useTasks({ status: "inbox,open" });
  const list = tasks.data ?? [];

  const moveTo = (taskId: string, zone: string) => {
    const quadrant = QUADRANTS.find((q) => q.id === zone);
    const task = list.find((t) => t.id === taskId);
    if (!quadrant || !task) return;
    const body = quadrantChange(task, quadrant);
    if (body.urgent === task.urgent && body.priority === task.priority) return;
    patchTaskCaches(client, task.id, body);
    fire({ method: "PATCH", path: `/tasks/${task.id}`, body, label: "Couldn't move the task" });
  };

  const header = (
    <PageHeader
      title="Eisenhower"
      subtitle="Drag between boxes, or use a task's menu"
      back={{ to: "/plan", label: "Plan" }}
    />
  );
  if (settings && !settings.advancedViews.eisenhower)
    return (
      <div className="flex flex-col gap-7">
        {header}
        <EmptyState
          title="The Eisenhower grid is off"
          message="Turn it on in Settings › Today and planning to sort tasks by urgent and important."
          mood="calm"
        />
        <Link
          to="/settings"
          className="self-center text-callout font-bold text-sky-text hover:underline"
        >
          Open Settings
        </Link>
      </div>
    );

  return (
    <div className="flex flex-col gap-7">
      {header}
      {tasks.isError && !tasks.data ? (
        <ErrorState onRetry={() => void tasks.refetch()} />
      ) : !tasks.data ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {QUADRANTS.map((q) => (
            <Skeleton key={q.id} className="h-56 rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          title="Nothing to sort yet"
          message="Open tasks land here so you can decide what really matters."
          actionLabel="Capture something"
          onAction={focusQuickAdd}
        />
      ) : (
        <PlanDnd
          onDrop={moveTo}
          renderOverlay={(id) => {
            const task = list.find((t) => t.id === id);
            return task ? <CompactTask task={task} preview tone="neutral" /> : null;
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {QUADRANTS.map((quadrant) => {
              const items = list.filter(
                (t) =>
                  t.urgent === quadrant.urgent && (t.priority === "high") === quadrant.important,
              );
              return (
                <DropArea
                  key={quadrant.id}
                  id={quadrant.id}
                  label={quadrant.title}
                  className="flex min-h-56 flex-col gap-2 rounded-2xl bg-card/70 p-3"
                >
                  <div className="px-1">
                    <h2 className={cx("text-body font-bold", quadrant.tone)}>{quadrant.title}</h2>
                    <p className="text-caption text-muted">{quadrant.hint}</p>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {items.map((task) => (
                      <li key={task.id}>
                        <Draggable id={task.id}>
                          <CompactTask
                            task={task}
                            tone={quadrant.id === "plan" ? "sky" : "neutral"}
                            // The keyboard's way between boxes: each other box, by name.
                            actions={QUADRANTS.filter((q) => q.id !== quadrant.id).map((q) => ({
                              label: `Move to ${q.title}`,
                              run: () => moveTo(task.id, q.id),
                            }))}
                          />
                        </Draggable>
                      </li>
                    ))}
                  </ul>
                </DropArea>
              );
            })}
          </div>
        </PlanDnd>
      )}
    </div>
  );
}
