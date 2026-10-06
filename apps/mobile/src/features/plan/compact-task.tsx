import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { type A11yAction, a11yActionProps } from "@/components/ui/a11y-actions";
import { Text } from "@/components/ui/text";
import { formatClock, formatMinutes } from "@/lib/format";
import type { PlanTask } from "./queries";

/** What dragging does, offered to screen readers in the actions menu instead. */
export type PlanAction = A11yAction;

/** A slim task card for planners, where long-press picks it up for dragging. */
export function CompactTask({
  task,
  tone = "sky",
  actions = [],
}: {
  task: PlanTask;
  /** "neutral" for tasks that have no time yet. */
  tone?: "sky" | "grape" | "coral" | "neutral";
  actions?: PlanAction[];
}) {
  const router = useRouter();
  const bar = { sky: "bg-sky", grape: "bg-grape", coral: "bg-coral", neutral: "bg-line-strong" }[
    tone
  ];
  return (
    <Pressable
      onPress={() => router.push(`/task/${task.id}`)}
      className="min-h-12 flex-row items-center gap-2 rounded-xl bg-card px-3 py-2.5"
      accessibilityRole="button"
      accessibilityHint={
        actions.length ? "Opens the task. Scheduling is in the actions menu" : "Opens the task"
      }
      {...a11yActionProps(actions)}
    >
      <View className={`h-6 w-1 rounded-full ${bar}`} />
      <Text
        className={`flex-1 ${task.status === "done" ? "text-muted line-through" : ""}`}
        numberOfLines={1}
      >
        {task.title}
      </Text>
      <Text variant="caption" tone="muted" numeric>
        {[
          task.hasTime && task.doAt ? formatClock(task.doAt) : null,
          task.estimateMin ? formatMinutes(task.estimateMin) : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </Text>
    </Pressable>
  );
}
