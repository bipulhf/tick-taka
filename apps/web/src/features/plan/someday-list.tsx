import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Plus } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { patchTaskCaches, useTaskActions } from "@/features/tasks/use-task-actions";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { fire } from "@/lib/write";
import { type PlanTask, useTasks } from "./queries";

function SomedayRow({ task, emoji }: { task: PlanTask; emoji?: string }) {
  const open = useOpenPanel();
  const client = useQueryClient();
  const actions = useTaskActions();
  const toInbox = () => {
    patchTaskCaches(client, task.id, { status: "inbox" });
    fire({
      method: "PATCH",
      path: `/tasks/${task.id}`,
      body: { status: "inbox" },
      label: "Couldn't move the task",
    });
  };
  const keyActions = useMemo(
    () => ({ toggle: () => actions.toggleDone(task), remove: () => actions.remove(task) }),
    [actions, task],
  );
  return (
    <Row
      as="li"
      dataKey={`task:${task.id}`}
      keyActions={keyActions}
      title={
        <>
          {emoji ? <span aria-hidden>{emoji} </span> : null}
          {task.title}
        </>
      }
      onClick={() => open(`task:${task.id}`)}
      trailing={
        <Button
          size="sm"
          icon={Inbox}
          onClick={toInbox}
          aria-label={`Move “${task.title}” to the inbox`}
        >
          Inbox
        </Button>
      }
    />
  );
}

/** Ideas parked for later. They never show on Today; the monthly review checks them. */
export function SomedayList() {
  const open = useOpenPanel();
  const { data: areas = [] } = useAreas();
  const tasks = useTasks({ status: "someday" });
  // A task sent to the inbox leaves at once.
  const list = (tasks.data ?? []).filter((t) => t.status === "someday");
  const addIdea = () => open("task:new", { status: "someday" });
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Someday"
        subtitle="Ideas parked for later"
        back={{ to: "/plan", label: "Plan" }}
        actions={
          <Button icon={Plus} onClick={addIdea}>
            Add an idea
          </Button>
        }
      />
      <div>
        {tasks.isError && !tasks.data ? (
          <ErrorState onRetry={() => void tasks.refetch()} />
        ) : !tasks.data ? (
          <SkeletonRows rows={4} />
        ) : list.length === 0 ? (
          <EmptyState
            title="Nothing parked yet"
            message="Park ideas here to keep Today light. Add one with “someday” in quick-add."
            actionLabel="Add an idea"
            onAction={addIdea}
          />
        ) : (
          <Group as="ul" label="Someday">
            {list.map((task) => (
              <SomedayRow
                key={task.id}
                task={task}
                emoji={areas.find((a) => a.id === task.areaId)?.emoji}
              />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}
