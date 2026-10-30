import { Star } from "lucide-react";
import { useEffect, useRef } from "react";
import { celebrate } from "@/components/ui/confetti";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { Section, SectionAction } from "@/components/ui/section";
import { TaskRow } from "@/features/tasks/task-row";
import { useOpenPanel } from "@/lib/panel";
import type { TodayData } from "@/lib/queries";

/** The three that matter most today; all three done is a celebration. */
export function TopThree({ data }: { data: TodayData }) {
  const open = useOpenPanel();
  const allDone = data.topThree.length === 3 && data.topThree.every((t) => t.status === "done");
  const wasDone = useRef(allDone);
  useEffect(() => {
    if (allDone && !wasDone.current) celebrate();
    wasDone.current = allDone;
  }, [allDone]);
  const pick = () => open(`top-three:${data.date}`);
  return (
    <Section
      title="Top three"
      id="today-top-three"
      action={
        <SectionAction onClick={pick}>{data.topThree.length < 3 ? "Pick" : "Change"}</SectionAction>
      }
    >
      {data.topThree.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No top three yet"
          message="Pick what matters most today."
          actionLabel="Pick"
          onAction={pick}
        />
      ) : (
        <Group as="ul" label="Top three">
          {data.topThree.map((task) => (
            <TaskRow key={task.id} as="li" task={task} size="lg" />
          ))}
        </Group>
      )}
    </Section>
  );
}
