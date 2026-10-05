import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonList } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { TASK_ROW_INSET, TaskRow } from "@/features/tasks/task-row";
import { useOutbox } from "@/lib/outbox";
import { useAreas } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useProjects, useTasks } from "./queries";

/** Areas hold projects; projects hold tasks. */
export function AreaDetail({ areaId }: { areaId: string }) {
  const router = useRouter();
  const send = useOutbox();
  const { data: areas = [] } = useAreas();
  const area = areas.find((a) => a.id === areaId);
  const projects = useProjects(areaId);
  const tasks = useTasks({ areaId, status: "inbox,open" });
  const [name, setName] = useState("");
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
      <AsyncContent query={projects} skeleton={<SkeletonList rows={4} />}>
        {() => (
          <AsyncContent
            query={tasks}
            skeleton={<SkeletonList rows={4} />}
            isEmpty={() => projectList.length === 0 && loose.length === 0}
            empty={
              <EmptyState
                title="No projects yet"
                message="Name one above to group related tasks in this area."
              />
            }
          >
            {() => (
              <>
                {projectList.map((project) => {
                  const projectTasks = (tasks.data ?? []).filter((t) => t.projectId === project.id);
                  const nextStatus =
                    project.status === "active"
                      ? "paused"
                      : project.status === "paused"
                        ? "done"
                        : "active";
                  return (
                    <Section
                      key={project.id}
                      title={project.name}
                      action={project.status}
                      onAction={() =>
                        send({
                          method: "PATCH",
                          path: `/projects/${project.id}`,
                          body: { status: nextStatus, updatedAt: editTime() },
                        })
                      }
                    >
                      {projectTasks.length === 0 ? (
                        <Text variant="callout" tone="muted" className="px-1">
                          No open tasks.
                        </Text>
                      ) : (
                        <Group inset={TASK_ROW_INSET}>
                          {projectTasks.map((task) => (
                            <TaskRow key={task.id} task={task} showWhen />
                          ))}
                        </Group>
                      )}
                    </Section>
                  );
                })}
                {loose.length > 0 ? (
                  <Section title="No project">
                    <Group inset={TASK_ROW_INSET}>
                      {loose.map((task) => (
                        <TaskRow key={task.id} task={task} showWhen />
                      ))}
                    </Group>
                  </Section>
                ) : null}
              </>
            )}
          </AsyncContent>
        )}
      </AsyncContent>
      <Button
        label="Rename or recolour areas"
        variant="ghost"
        size="sm"
        onPress={() => router.push("/settings/areas")}
      />
    </Screen>
  );
}
