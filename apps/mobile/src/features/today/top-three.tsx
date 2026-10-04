import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { celebrate } from "@/components/ui/confetti";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { TASK_ROW_INSET, TaskRow } from "@/features/tasks/task-row";
import type { TodayData } from "@/lib/queries";

export function TopThree({ data }: { data: TodayData }) {
  const router = useRouter();
  const allDone = data.topThree.length === 3 && data.topThree.every((t) => t.status === "done");
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) celebrate();
    wasDone.current = allDone;
  }, [allDone]);
  const pick = () => router.push(`/pick-top-three?date=${data.date}`);
  return (
    <Section
      title="Top three"
      action={data.topThree.length < 3 ? "Pick" : "Change"}
      onAction={pick}
    >
      {data.topThree.length === 0 ? (
        <EmptyState
          icon="star-outline"
          title="No top three yet"
          message="Pick what matters most today."
          actionLabel="Pick"
          onAction={pick}
        />
      ) : (
        <Group inset={TASK_ROW_INSET}>
          {data.topThree.map((task) => (
            <TaskRow key={task.id} task={task} today={data.date} size="lg" />
          ))}
        </Group>
      )}
    </Section>
  );
}
