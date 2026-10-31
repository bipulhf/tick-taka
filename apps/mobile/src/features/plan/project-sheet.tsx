import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DeleteButton } from "@/components/ui/delete-button";
import { ErrorState } from "@/components/ui/empty-state";
import { PickerField } from "@/components/ui/picker-field";
import { Sheet } from "@/components/ui/sheet";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { useOutbox } from "@/lib/outbox";
import { useAreas } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useProjects } from "./queries";

type Project = NonNullable<ReturnType<typeof useProjects>["data"]>[number];
type Status = Project["status"];

const STATUSES: { value: Status; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "done", label: "Done" },
];

/** Rename a project, move it to another area or change its status. */
export function ProjectSheet({ id }: { id: string }) {
  const projects = useProjects();
  const project = projects.data?.find((p) => p.id === id);
  // Wait for the record so the form's fields start filled, even with nothing cached.
  if (!project)
    return (
      <Sheet title="Project">
        {projects.isError ? (
          <ErrorState onRetry={() => void projects.refetch()} />
        ) : (
          <SkeletonForm fields={3} />
        )}
      </Sheet>
    );
  return <ProjectForm project={project} />;
}

function ProjectForm({ project }: { project: Project }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
  const { data: areas = [] } = useAreas();
  const [name, setName] = useState(project.name);
  const [areaId, setAreaId] = useState<string | null>(project.areaId);
  const [status, setStatus] = useState<Status>(project.status);
  const save = () => {
    if (!name.trim() || !areaId) return;
    const body = { name: name.trim(), areaId, status };
    send({
      method: "PATCH",
      path: `/projects/${project.id}`,
      body: { ...body, updatedAt: editTime() },
      label: "Couldn't save",
    });
    router.back();
  };
  return (
    <Sheet
      title={project.name}
      footer={
        <View className="flex-row gap-2">
          <DeleteButton
            onPress={() => {
              remove(`/projects/${project.id}`, `“${project.name}”`);
              router.back();
            }}
          />
          <Button
            label="Save"
            onPress={save}
            disabled={!name.trim() || !areaId}
            className="flex-1"
          />
        </View>
      }
    >
      <TextField label="Name" value={name} onChangeText={setName} />
      <PickerField
        label="Area"
        value={areaId}
        placeholder="Pick an area"
        options={areas.map((area) => ({ id: area.id, label: area.name, emoji: area.emoji }))}
        onChange={(id) => id && setAreaId(id)}
      />
      <Text variant="label" tone="muted">
        Status
      </Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Status"
        className="flex-row flex-wrap gap-2"
      >
        {STATUSES.map((s) => (
          <Chip
            key={s.value}
            label={s.label}
            choice="single"
            selected={status === s.value}
            onPress={() => setStatus(s.value)}
          />
        ))}
      </View>
    </Sheet>
  );
}
