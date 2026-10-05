import { newId } from "@tick-taka/shared/ids";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { AsyncContent } from "@/components/ui/async-content";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Screen } from "@/components/ui/screen";
import { Section } from "@/components/ui/section";
import { SkeletonList } from "@/components/ui/skeleton";
import { editDelete, SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { TextField } from "@/components/ui/text-field";
import { TASK_ROW_INSET, TaskRow } from "@/features/tasks/task-row";
import { useOutbox } from "@/lib/outbox";
import { useAreas } from "@/lib/queries";
import { editTime } from "@/lib/server-clock";
import { useRemove } from "@/lib/use-remove";
import { useProjects, useTasks } from "./queries";

/** Areas hold projects; projects hold tasks. */
export function AreaDetail({ areaId }: { areaId: string }) {
  const router = useRouter();
  const send = useOutbox();
  const remove = useRemove();
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
                  const edit = () => router.push(`/project/${project.id}`);
                  return (
                    <View key={project.id} className="gap-3">
                      <SwipeRow
                        actions={editDelete(edit, () =>
                          remove(`/projects/${project.id}`, `“${project.name}”`),
                        )}
                      >
                        <View className="min-h-12 flex-row items-center justify-between gap-3 bg-background px-1">
                          <Pressable
                            onPress={edit}
                            accessibilityRole="button"
                            accessibilityHint="Opens the project. Swipe left for edit and delete"
                            className="flex-1"
                          >
                            <Text variant="heading" accessibilityRole="header" numberOfLines={1}>
                              {project.name}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              send({
                                method: "PATCH",
                                path: `/projects/${project.id}`,
                                body: { status: nextStatus, updatedAt: editTime() },
                              })
                            }
                            hitSlop={14}
                            accessibilityRole="button"
                          >
                            <Text variant="callout" className="font-nunito-bold" tone="sky">
                              {project.status}
                            </Text>
                          </Pressable>
                        </View>
                      </SwipeRow>
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
                    </View>
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
