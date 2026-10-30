import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Menu } from "@/components/ui/menu";
import { fire } from "@/lib/write";
import type { Project } from "./queries";

export type ProjectStatus = Project["status"];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];

export const statusLabel = (status: ProjectStatus) =>
  PROJECT_STATUSES.find((s) => s.value === status)?.label ?? status;

/** Changes a project's status at once in every cached project list. */
export function useSetProjectStatus() {
  const client = useQueryClient();
  return (project: Project, status: ProjectStatus) => {
    client.setQueriesData<Project[]>({ queryKey: ["projects"] }, (old) =>
      Array.isArray(old) ? old.map((p) => (p.id === project.id ? { ...p, status } : p)) : old,
    );
    fire({
      method: "PATCH",
      path: `/projects/${project.id}`,
      body: { status },
      label: "Couldn't change the project",
    });
  };
}

/** A project's status as a small button that opens the three choices. */
export function ProjectStatusMenu({ project }: { project: Project }) {
  const setStatus = useSetProjectStatus();
  return (
    <Menu
      items={PROJECT_STATUSES.map((s) => ({
        label: s.label,
        icon: s.value === project.status ? Check : undefined,
        onSelect: () => setStatus(project, s.value),
      }))}
      trigger={
        <button
          type="button"
          aria-label={`Status: ${statusLabel(project.status)}. Change`}
          className="rounded-lg px-2 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
        >
          {statusLabel(project.status)}
        </button>
      }
    />
  );
}
