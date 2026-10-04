import { toLocalDate } from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { TaskRow } from "@/features/tasks/task-row";
import { useOutbox } from "@/lib/outbox";
import { useAreas } from "@/lib/queries";
import { useProjects, useTasks } from "./queries";

/** Areas hold projects; projects hold tasks. */
export function AreaDetail({ areaId }: { areaId: string }) {
  const send = useOutbox();
  const { data: areas = [] } = useAreas();
  const area = areas.find((a) => a.id === areaId);
  const projects = useProjects(areaId);
  const tasks = useTasks({ areaId, status: "inbox,open" });
  const [name, setName] = useState("");
  const today = toLocalDate(Date.now());
  const projectList = projects.data ?? [];
  const loose = (tasks.data ?? []).filter((t) => !t.projectId);

  return (
    <Screen title={`${area?.emoji ?? ""} ${area?.name ?? "Area"}`} tabBarPadding={false}>
      <View className="flex-row gap-2">
        <TextField
          value={name}
          onChangeText={setName}
          placeholder="New project"
          className="flex-1"
        />
        <Button
          label="Add"
          disabled={!name.trim()}
          onPress={() => {
            send({
              method: "POST",
              path: "/projects",
              body: { id: newId(), areaId, name: name.trim() },
              label: "Couldn't add the project",
            });
            setName("");
          }}
        />
      </View>
      {projectList.map((project) => {
        const projectTasks = (tasks.data ?? []).filter((t) => t.projectId === project.id);
        const nextStatus =
          project.status === "active" ? "paused" : project.status === "paused" ? "done" : "active";
        return (
          <Section
            key={project.id}
            title={project.name}
            action={project.status}
            onAction={() =>
              send({
                method: "PATCH",
                path: `/projects/${project.id}`,
                body: { status: nextStatus, updatedAt: Date.now() },
              })
            }
          >
            <View className="gap-2">
              {projectTasks.length === 0 ? (
                <Text variant="caption" tone="muted">
                  No open tasks.
                </Text>
              ) : null}
              {projectTasks.map((task) => (
                <TaskRow key={task.id} task={task} today={today} showWhen />
              ))}
            </View>
          </Section>
        );
      })}
      {loose.length > 0 ? (
        <Section title="No project">
          <View className="gap-2">
            {loose.map((task) => (
              <TaskRow key={task.id} task={task} today={today} showWhen />
            ))}
          </View>
        </Section>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Rename or recolour this area in Settings" />
      </View>
    </Screen>
  );
}
