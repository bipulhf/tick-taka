import { Link } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { ChevronRight, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows, ViewSkeleton } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { TaskRow } from "@/features/tasks/task-row";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { remove, write } from "@/lib/write";
import { AreaSummary } from "./area-summary";
import { ProjectStatusMenu } from "./project-status";
import { type PlanTask, type Project, useAllProjects, useTasks } from "./queries";

function ProjectBlock({ project, tasks }: { project: Project; tasks: PlanTask[] }) {
  const open = useOpenPanel();
  return (
    <section aria-labelledby={`project-${project.id}`} className="flex flex-col gap-2">
      <div className="flex min-h-9 items-center gap-2 px-1">
        <Link
          to="/plan/project/$id"
          params={{ id: project.id }}
          id={`project-${project.id}`}
          className="group/link flex min-w-0 flex-1 items-center gap-1 rounded-lg text-heading hover:text-sky-text"
        >
          <span className="truncate">{project.name}</span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" />
        </Link>
        <ProjectStatusMenu project={project} />
        <Menu
          items={[
            { label: "Edit", icon: Pencil, onSelect: () => open(`project:${project.id}`) },
            "separator",
            {
              label: "Delete",
              icon: Trash2,
              danger: true,
              onSelect: () =>
                void remove(`/projects/${project.id}`, `“${project.name}”`).catch(() => {}),
            },
          ]}
          trigger={
            <IconButton icon={MoreHorizontal} label={`More for ${project.name}`} size="sm" />
          }
        />
      </div>
      {tasks.length === 0 ? (
        <p className="px-1 text-callout text-muted">No open tasks.</p>
      ) : (
        <Group as="ul" label={project.name}>
          {tasks.map((task) => (
            <TaskRow key={task.id} as="li" task={task} showWhen />
          ))}
        </Group>
      )}
    </section>
  );
}

/** Areas hold projects; projects hold tasks. The header sums up the week and the month. */
export function AreaDetail({ areaId }: { areaId: string }) {
  const open = useOpenPanel();
  const areas = useAreas();
  const area = areas.data?.find((a) => a.id === areaId);
  const projects = useAllProjects(areaId);
  const tasks = useTasks({ areaId, status: "inbox,open" });
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const projectList = projects.data ?? [];
  const loose = (tasks.data ?? []).filter((t) => !t.projectId);

  if (!areas.data)
    return areas.isError ? <ErrorState onRetry={() => void areas.refetch()} /> : <ViewSkeleton />;
  if (!area)
    return (
      <div className="flex flex-col gap-7">
        <PageHeader title="Area" back={{ to: "/plan", label: "Plan" }} />
        <EmptyState title="That area is no longer here" message="It may have been deleted." />
      </div>
    );

  const addProject = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    try {
      await write({
        method: "POST",
        path: "/projects",
        body: { id: newId(), areaId, name: name.trim() },
        label: "Couldn't add the project",
      });
      setName("");
    } catch {
      // The toast says why; the name stays to try again.
    } finally {
      setAdding(false);
    }
  };

  const loading = !projects.data || !tasks.data;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title={`${area.emoji} ${area.name}`}
        subtitle={<AreaSummary areaId={area.id} />}
        back={{ to: "/plan", label: "Plan" }}
        actions={
          <>
            <Button icon={Pencil} onClick={() => open(`area:${area.id}`)}>
              Edit area
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => open("task:new", { areaId: area.id, status: "inbox" })}
            >
              New task
            </Button>
          </>
        }
      />
      <form
        className="flex max-w-xl gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void addProject();
        }}
      >
        <TextField
          aria-label="New project"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="New project"
          className="flex-1"
        />
        <Button type="submit" icon={FolderPlus} disabled={!name.trim()} loading={adding}>
          Add
        </Button>
      </form>
      {(projects.isError || tasks.isError) && loading ? (
        <ErrorState
          onRetry={() => {
            void projects.refetch();
            void tasks.refetch();
          }}
        />
      ) : loading ? (
        <SkeletonRows rows={4} />
      ) : projectList.length === 0 && loose.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Name one above to group related tasks in this area."
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          {projectList.map((project) => (
            <ProjectBlock
              key={project.id}
              project={project}
              tasks={(tasks.data ?? []).filter((t) => t.projectId === project.id)}
            />
          ))}
          {loose.length > 0 ? (
            <Section id="no-project" title="No project">
              <Group as="ul" label="No project">
                {loose.map((task) => (
                  <TaskRow key={task.id} as="li" task={task} showWhen />
                ))}
              </Group>
            </Section>
          ) : null}
        </div>
      )}
    </div>
  );
}
