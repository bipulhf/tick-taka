import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { View } from "react-native";
import { celebrate } from "@/components/ui/confetti";
import { EmptyState } from "@/components/ui/empty-state";
import { Section } from "@/components/ui/section";
import { TaskRow } from "@/features/tasks/task-row";
import type { TodayData } from "@/lib/queries";

export function TopThree({ data }: { data: TodayData }) {
  const router = useRouter();
  const allDone = data.topThree.length === 3 && data.topThree.every((t) => t.status === "done");
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) celebrate();
    wasDone.current = allDone;
  }, [allDone]);
  return (
    <Section
      title="Top three"
      action={data.topThree.length < 3 ? "Pick" : "Change"}
      onAction={() => router.push(`/pick-top-three?date=${data.date}`)}
    >
      {data.topThree.length === 0 ? (
        <EmptyState
          message="Pick the three things that matter most today."
          actionLabel="Pick top three"
          onAction={() => router.push(`/pick-top-three?date=${data.date}`)}
        />
      ) : (
        <View className="gap-2">
          {data.topThree.map((task) => (
            <TaskRow key={task.id} task={task} today={data.date} size="lg" />
          ))}
        </View>
      )}
    </Section>
  );
}
