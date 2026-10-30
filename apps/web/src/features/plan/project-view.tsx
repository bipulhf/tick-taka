import { CheckCircle2, ListTodo, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonRows, ViewSkeleton } from "@/components/ui/skeleton";
import { TaskRow } from "@/features/tasks/task-row";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { PROJECT_STATUSES, type ProjectStatus, useSetProjectStatus } from "./project-status";
import { useAllProjects, useTasks } from "./queries";

/** One project: its open tasks beside what's finished, its status, and Edit. */
export function ProjectView({ projectId }: { projectId: string }) {
  const open = useOpenPanel();
  const projects = useAllProjects();
  const { data: areas = [] } = useAreas();
  const project = projects.data?.find((p) => p.id === projectId);
  const area = areas.find((a) => a.id === project?.areaId);
  const openTasks = useTasks({ projectId, status: "inbox,open,someday" });
  const doneTasks = useTasks({ projectId, status: "done", limit: "50" });
  const setStatus = useSetProjectStatus();

  if (!projects.data)
    return projects.isError ? (
      <ErrorState onRetry={() => void projects.refetch()} />
    ) : (
      <ViewSkeleton />
    );
  if (!project)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Project" back={{ to: "/plan", label: "Plan" }} />
        <EmptyState title="That project is no longer here" message="It may have been deleted." />
      </div>
    );

  const list = (openTasks.data ?? []).filter((t) => t.status !== "done");
  const finished = (doneTasks.data ?? []).filter((t) => t.status === "done");
  const addTask = () =>
    open("task:new", { areaId: project.areaId, projectId: project.id, status: "inbox" });

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={project.name}
        subtitle={area ? `${area.emoji} ${area.name}` : undefined}
        back={
          area ? { to: `/plan/area/${area.id}`, label: area.name } : { to: "/plan", label: "Plan" }
        }
        actions={
          <>
            <Button icon={Pencil} onClick={() => open(`project:${project.id}`)}>
              Edit
            </Button>
            <Button variant="primary" icon={Plus} onClick={addTask}>
              New task
            </Button>
          </>
        }
      />
      <Segmented<ProjectStatus>
        label="Project status"
        value={project.status}
        onChange={(status) => setStatus(project, status)}
        options={PROJECT_STATUSES}
        className="self-start"
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section
          id="project-open"
          title="To do"
          caption={openTasks.data ? plural(list.length, "open task") : undefined}
        >
          {openTasks.isError && !openTasks.data ? (
            <ErrorState onRetry={() => void openTasks.refetch()} />
          ) : !openTasks.data ? (
            <SkeletonRows rows={4} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title="No open tasks"
              message="Add the next step, so this project keeps moving."
              actionLabel="Add"
              onAction={addTask}
            />
          ) : (
            <Group as="ul" label="To do">
              {list.map((task) => (
                <TaskRow key={task.id} as="li" task={task} showWhen />
              ))}
            </Group>
          )}
        </Section>
        <Section id="project-done" title="Finished">
          {!doneTasks.data ? (
            <SkeletonRows rows={2} />
          ) : finished.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="Finished tasks of this project gather here." />
          ) : (
            <Group as="ul" label="Finished">
              {finished.map((task) => (
                <TaskRow key={task.id} as="li" task={task} />
              ))}
            </Group>
          )}
        </Section>
      </div>
    </div>
  );
}
