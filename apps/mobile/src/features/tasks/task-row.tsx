import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { SwipeRow } from "@/components/ui/swipe-row";
import { Text } from "@/components/ui/text";
import { formatMinutes, formatWhen } from "@/lib/format";
import type { TaskRow as Task } from "@/lib/queries";
import { useTaskActions } from "./use-task-actions";

export interface TaskRowProps {
  task: Task;
  size?: "md" | "lg";
  showWhen?: boolean;
  areaEmoji?: string;
}

const DEADLINE_WARN_MS = 3 * 86_400_000;

/** Separator inset that lines up with the task title, past the checkbox. */
export const TASK_ROW_INSET = 46;

export function TaskRow({ task, size = "md", showWhen = false, areaEmoji }: TaskRowProps) {
  const router = useRouter();
  const actions = useTaskActions();
  const done = task.status === "done";
  const deadlineSoon =
    task.deadlineAt !== null && !done && task.deadlineAt - Date.now() < DEADLINE_WARN_MS;
  const meta = [
    showWhen && task.doAt !== null ? formatWhen(task.doAt, task.hasTime) : null,
    task.estimateMin ? formatMinutes(task.estimateMin) : null,
    task.rrule ? "↻" : null,
  ].filter(Boolean);
  return (
    <SwipeRow
      rounded={false}
      right={{
        icon: done ? "undo" : "check-bold",
        className: "bg-mint",
        onTrigger: () => actions.toggleDone(task),
      }}
      actions={[
        { label: "Snooze", icon: "clock-fast", tone: "sky", onPress: () => actions.snooze(task) },
        {
          label: "Delete",
          icon: "trash-can-outline",
          tone: "coral",
          onPress: () => actions.remove(task),
        },
      ]}
    >
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        onLongPress={() => router.push(`/task/${task.id}`)}
        className="min-h-[60px] flex-row items-center gap-1 bg-card pr-4"
        accessibilityHint="Swipe right to complete, left for snooze and delete"
      >
        <Checkbox
          checked={done}
          onChange={() => actions.toggleDone(task)}
          size={size}
          label={task.title}
        />
        <View className="flex-1 py-3">
          <Text
            variant="strong"
            className={done ? "text-muted line-through" : ""}
            numberOfLines={2}
          >
            {areaEmoji ? `${areaEmoji} ` : ""}
            {task.title}
          </Text>
          {meta.length || deadlineSoon ? (
            <Text variant="callout" tone={deadlineSoon ? "coral" : "muted"}>
              {[
                ...meta,
                deadlineSoon && task.deadlineAt
                  ? `Due ${formatWhen(task.deadlineAt, false)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          ) : null}
        </View>
        {task.priority === "high" ? <Icon name="flag" size={20} color="coral" /> : null}
      </Pressable>
    </SwipeRow>
  );
}
