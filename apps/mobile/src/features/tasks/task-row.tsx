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
  today: string;
  size?: "md" | "lg";
  showWhen?: boolean;
  areaEmoji?: string;
}

const DEADLINE_WARN_MS = 3 * 86_400_000;

export function TaskRow({ task, today, size = "md", showWhen = false, areaEmoji }: TaskRowProps) {
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
      right={{
        icon: done ? "undo" : "check-bold",
        className: "bg-mint",
        onTrigger: () => actions.toggleDone(task, today),
      }}
      left={{ icon: "clock-fast", className: "bg-sky", onTrigger: () => actions.snooze(task) }}
    >
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        onLongPress={() => router.push(`/task/${task.id}`)}
        className="flex-row items-center gap-1 rounded-2xl bg-card pr-3"
        accessibilityHint="Swipe right to complete, left to snooze"
      >
        <Checkbox
          checked={done}
          onChange={() => actions.toggleDone(task, today)}
          size={size}
          label={task.title}
        />
        <View className="flex-1 py-3">
          <Text
            variant={size === "lg" ? "strong" : "body"}
            className={done ? "text-muted line-through" : ""}
            numberOfLines={2}
          >
            {areaEmoji ? `${areaEmoji} ` : ""}
            {task.title}
          </Text>
          {meta.length || deadlineSoon ? (
            <Text variant="caption" tone={deadlineSoon ? "coral" : "muted"}>
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
        {task.priority === "high" ? <Icon name="flag" size={18} color="coral" /> : null}
      </Pressable>
    </SwipeRow>
  );
}
