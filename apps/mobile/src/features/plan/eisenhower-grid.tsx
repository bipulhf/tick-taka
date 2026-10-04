import { View } from "react-native";
import { Draggable, DragProvider, DropZone } from "@/components/ui/drag";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useOutbox } from "@/lib/outbox";
import { CompactTask } from "./compact-task";
import { useTasks } from "./queries";

const QUADRANTS = [
  {
    id: "do",
    title: "Do now",
    hint: "Urgent · important",
    urgent: true,
    important: true,
    tone: "coral" as const,
  },
  {
    id: "plan",
    title: "Schedule",
    hint: "Important, not urgent",
    urgent: false,
    important: true,
    tone: "sky" as const,
  },
  {
    id: "delegate",
    title: "Squeeze in",
    hint: "Urgent, not important",
    urgent: true,
    important: false,
    tone: "grape" as const,
  },
  {
    id: "drop",
    title: "Drop",
    hint: "Neither",
    urgent: false,
    important: false,
    tone: "grape" as const,
  },
];

/** Drag tasks into the urgent/important grid to decide what to drop. */
export function EisenhowerGrid() {
  const send = useOutbox();
  const tasks = useTasks({ status: "inbox,open" });
  const list = tasks.data ?? [];
  const onDrop = (taskId: string, zoneId: string) => {
    const quadrant = QUADRANTS.find((q) => q.id === zoneId);
    const task = list.find((t) => t.id === taskId);
    if (!quadrant || !task) return;
    send({
      method: "PATCH",
      path: `/tasks/${task.id}`,
      body: {
        urgent: quadrant.urgent,
        priority: quadrant.important ? "high" : task.priority === "high" ? "normal" : task.priority,
        updatedAt: Date.now(),
      },
      label: "Couldn't move the task",
    });
  };
  return (
    <DragProvider onDrop={onDrop}>
      <Screen title="Eisenhower" subtitle="Long-press and drag between boxes" tabBarPadding={false}>
        <View className="flex-row flex-wrap justify-between gap-y-3">
          {QUADRANTS.map((quadrant) => {
            const items = list.filter(
              (t) => t.urgent === quadrant.urgent && (t.priority === "high") === quadrant.important,
            );
            return (
              <DropZone
                key={quadrant.id}
                id={quadrant.id}
                className="min-h-56 w-[48.5%] gap-2 rounded-2xl bg-card/70 p-2"
              >
                <Text variant="strong" tone={quadrant.tone}>
                  {quadrant.title}
                </Text>
                <Text variant="caption" tone="muted">
                  {quadrant.hint}
                </Text>
                {items.map((task) => (
                  <Draggable key={task.id} id={task.id}>
                    <CompactTask task={task} tone={quadrant.tone} />
                  </Draggable>
                ))}
              </DropZone>
            );
          })}
        </View>
      </Screen>
    </DragProvider>
  );
}
