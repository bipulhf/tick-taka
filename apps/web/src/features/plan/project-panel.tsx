import { useNavigate } from "@tanstack/react-router";
import { newId } from "@tick-taka/shared/ids";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { usePath } from "@/components/shell/sidebar";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { Field, TextField } from "@/components/ui/text-field";
import { useAreas } from "@/lib/queries";
import { remove, write } from "@/lib/write";
import type { PanelComponentProps } from "../panel-types";
import { PROJECT_STATUSES, type ProjectStatus } from "./project-status";
import { type Project, useAllProjects } from "./queries";

/**
 * `?panel=project:<id>`: rename a project, move it to another area or change its
 * status. `project:new` adds one, with `areaId` from the preset.
 */
export function ProjectPanel({ id, onClose, preset }: PanelComponentProps) {
  const projects = useAllProjects();
  const editing = id !== "new";
  const project = editing ? projects.data?.find((p) => p.id === id) : undefined;
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (editing && !project)
    return (
      <Panel open onClose={onClose} title="Project">
        {projects.isError || projects.data ? (
          <ErrorState
            onRetry={() => void projects.refetch()}
            message={projects.data ? "That project is no longer here." : undefined}
          />
        ) : (
          <SkeletonRows rows={3} />
        )}
      </Panel>
    );
  return (
    <ProjectForm project={project ?? null} areaPreset={preset.get("areaId")} onClose={onClose} />
  );
}

function ProjectForm({
  project,
  areaPreset,
  onClose,
}: {
  project: Project | null;
  areaPreset: string | null;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const path = usePath();
  const { data: areas = [] } = useAreas();
  const [name, setName] = useState(project?.name ?? "");
  const [areaId, setAreaId] = useState<string | null>(project?.areaId ?? areaPreset ?? null);
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const valid = Boolean(name.trim() && areaId);
  const dirty = project
    ? name !== project.name || areaId !== project.areaId || status !== project.status
    : Boolean(name.trim());

  const save = async () => {
    if (!valid || saving) return;
    const body = { name: name.trim(), areaId, status };
    setSaving(true);
    try {
      if (project)
        await write({
          method: "PATCH",
          path: `/projects/${project.id}`,
          body,
          label: "Couldn't save",
        });
      else
        await write({
          method: "POST",
          path: "/projects",
          body: { id: newId(), ...body },
          label: "Couldn't add the project",
        });
      onClose();
    } catch {
      // The toast said why; what was typed stays.
      setSaving(false);
    }
  };

  return (
    <Panel
      open
      onClose={onClose}
      title={project ? project.name : "New project"}
      dirty={dirty && !saving}
      footer={
        <>
          {project ? (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => {
                void remove(`/projects/${project.id}`, `“${project.name}”`).catch(() => {});
                // Its own page has nothing left to show; go to the area it was in.
                if (path === `/plan/project/${project.id}`)
                  void navigate({ to: "/plan/area/$id", params: { id: project.areaId } });
                else onClose();
              }}
            >
              Delete
            </Button>
          ) : null}
          <Button
            variant="primary"
            className="flex-1"
            loading={saving}
            disabled={!valid}
            onClick={() => void save()}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <TextField
          label="Name"
          value={name}
          autoFocus={!project}
          onChange={(event) => setName(event.target.value)}
        />
        <Select
          label="Area"
          value={areaId}
          placeholder="Pick an area"
          onChange={setAreaId}
          options={areas.map((area) => ({ value: area.id, label: area.name, leading: area.emoji }))}
        />
        <Field label="Status">
          <Segmented<ProjectStatus>
            label="Status"
            value={status}
            onChange={setStatus}
            options={PROJECT_STATUSES}
            className="w-full"
          />
        </Field>
      </form>
    </Panel>
  );
}
