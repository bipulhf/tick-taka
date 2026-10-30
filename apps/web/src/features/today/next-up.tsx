import { useNavigate } from "@tanstack/react-router";
import { Sun } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { ProgressBar } from "@/components/ui/progress";
import { Section, SectionAction } from "@/components/ui/section";
import { TaskRow } from "@/features/tasks/task-row";
import { formatMinutes } from "@/lib/format";
import type { TodayData } from "@/lib/queries";
import { focusQuickAdd } from "@/lib/ui-state";

const SHOWN = 3;
const GRACE_MS = 30 * 60_000;

/**
 * The next few tasks today, after the top three, with how full the day is. The
 * full day is one click away. Bills and paydays sit with the money (MoneyDue).
 */
export function NextUp({
  data,
  areaEmoji,
}: {
  data: TodayData;
  areaEmoji: (areaId: string | null) => string | undefined;
}) {
  const navigate = useNavigate();
  const topIds = new Set(data.topThree.map((t) => t.id));
  const now = Date.now();
  const tasks = data.timeline.flatMap((item) =>
    item.kind === "task" &&
    !topIds.has(item.task.id) &&
    item.task.status !== "done" &&
    (item.at === null || item.at >= now - GRACE_MS)
      ? [item.task]
      : [],
  );
  const { plannedMinutes, capacityMinutes } = data.dayFit;
  const openDay = () => void navigate({ to: "/plan/day", search: { date: data.date } as never });
  return (
    <Section
      title="Next up"
      id="today-next-up"
      caption={
        plannedMinutes
          ? `${formatMinutes(plannedMinutes)} planned of ${formatMinutes(capacityMinutes)}`
          : undefined
      }
      action={<SectionAction onClick={openDay}>Full day</SectionAction>}
    >
      {plannedMinutes && capacityMinutes ? (
        <ProgressBar
          value={plannedMinutes / capacityMinutes}
          tone="sky"
          label="Planned time against free time today"
          className="mx-1 h-1.5"
        />
      ) : null}
      {tasks.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Nothing else scheduled"
          message="A calm day. Add something if you like."
          actionLabel="Add"
          onAction={focusQuickAdd}
        />
      ) : (
        <Group as="ul" label="Next up">
          {tasks.slice(0, SHOWN).map((task) => (
            <TaskRow
              key={task.id}
              as="li"
              task={task}
              showWhen
              areaEmoji={areaEmoji(task.areaId)}
            />
          ))}
          {tasks.length > SHOWN ? (
            <Row as="li" title={`${tasks.length - SHOWN} more today`} chevron onClick={openDay} />
          ) : null}
        </Group>
      )}
    </Section>
  );
}
