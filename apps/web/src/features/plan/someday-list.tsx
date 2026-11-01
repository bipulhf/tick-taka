import { addDays, toLocalDate } from "@tick-taka/shared/dates";
import { CalendarPlus, Inbox, Plus, Shuffle } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useTaskActions } from "@/features/tasks/use-task-actions";
import { formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { type PlanTask, useTasks } from "./queries";
import { useMoveTask } from "./use-move-task";

function SomedayRow({ task, emoji }: { task: PlanTask; emoji?: string }) {
  const open = useOpenPanel();
  const { timeZone } = useUserTime();
  const move = useMoveTask(timeZone);
  const actions = useTaskActions();
  const keyActions = useMemo(
    () => ({ toggle: () => actions.toggleDone(task), remove: () => actions.remove(task) }),
    [actions, task],
  );
  return (
    <Row
      as="li"
      dataKey={`task:${task.id}`}
      keyActions={keyActions}
      title={
        <>
          {emoji ? <span aria-hidden>{emoji} </span> : null}
          {task.title}
        </>
      }
      subtitle={`Parked ${formatLocalDate(toLocalDate(task.createdAt, timeZone))}`}
      onClick={() => open(`task:${task.id}`)}
      trailing={
        <Button
          size="sm"
          icon={Inbox}
          onClick={() => move.toInbox(task)}
          aria-label={`Move “${task.title}” to the inbox`}
        >
          Inbox
        </Button>
      }
    />
  );
}

/**
 * "Pick one for this week": one parked idea at a time, oldest first, with a day or
 * the inbox a click away. Another shows the next one.
 */
function PickOne({ ideas, emoji }: { ideas: PlanTask[]; emoji: (id: string | null) => string }) {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const move = useMoveTask(timeZone);
  const [turn, setTurn] = useState(0);
  const oldestFirst = [...ideas].sort((a, b) => a.createdAt - b.createdAt);
  const idea = oldestFirst[turn % oldestFirst.length];
  if (!idea) return null;
  return (
    <section
      aria-labelledby="someday-pick-title"
      className="flex flex-col gap-4 rounded-2xl bg-card p-4 sm:flex-row sm:items-center sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 id="someday-pick-title" className="text-caption text-muted">
          Pick one for this week
        </h2>
        <p className="truncate text-heading">
          {emoji(idea.areaId)}
          {idea.title}
        </p>
        <p className="text-callout text-muted">
          Parked {formatLocalDate(toLocalDate(idea.createdAt, timeZone))}. Give it a day, or let it
          wait.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" icon={Shuffle} onClick={() => setTurn(turn + 1)}>
          Another
        </Button>
        <Button size="sm" icon={Inbox} onClick={() => move.toInbox(idea)}>
          To the inbox
        </Button>
        <Button
          size="sm"
          variant="time"
          icon={CalendarPlus}
          onClick={() => move.toDay(idea, addDays(today, 1))}
        >
          Tomorrow
        </Button>
      </div>
    </section>
  );
}

/** Ideas parked for later. They never show on Today; the monthly review checks them. */
export function SomedayList() {
  const open = useOpenPanel();
  const { timeZone } = useUserTime();
  const { data: areas = [] } = useAreas();
  const tasks = useTasks({ status: "someday" });
  // A task sent to the inbox or given a day leaves at once.
  const list = (tasks.data ?? []).filter((t) => t.status === "someday");
  const addIdea = () => open("task:new", { status: "someday" });
  const emoji = (areaId: string | null) => {
    const mark = areas.find((a) => a.id === areaId)?.emoji;
    return mark ? `${mark} ` : "";
  };
  const oldest = list.reduce<PlanTask | null>(
    (first, t) => (first === null || t.createdAt < first.createdAt ? t : first),
    null,
  );
  const areaCount = new Set(list.map((t) => t.areaId).filter(Boolean)).size;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Someday"
        subtitle="Ideas parked for later"
        primary={{ label: "New idea", icon: Plus, onClick: addIdea }}
        summary={
          tasks.data && list.length === 0 ? undefined : (
            <SummaryStrip label="Someday">
              <StatTile
                label="Parked"
                value={list.length}
                caption={areaCount ? `Across ${plural(areaCount, "area")}` : "Off Today for now"}
                loading={!tasks.data}
              />
              <StatTile
                label="Waiting longest"
                tone="time"
                value={oldest ? formatLocalDate(toLocalDate(oldest.createdAt, timeZone)) : "None"}
                caption={oldest ? oldest.title : "Nothing parked"}
                loading={!tasks.data}
              />
            </SummaryStrip>
          )
        }
      />
      {tasks.isError && !tasks.data ? (
        <ErrorState onRetry={() => void tasks.refetch()} />
      ) : !tasks.data ? (
        <SkeletonRows rows={4} />
      ) : list.length === 0 ? (
        <EmptyState
          title="Nothing parked yet"
          message="Park ideas here to keep Today light. Add one with “someday” in quick-add."
          actionLabel="Add an idea"
          onAction={addIdea}
        />
      ) : (
        <>
          {/* With one idea the list already says it all. */}
          {list.length > 1 ? <PickOne ideas={list} emoji={emoji} /> : null}
          <Group as="ul" label="Someday">
            {list.map((task) => (
              <SomedayRow
                key={task.id}
                task={task}
                emoji={emoji(task.areaId).trim() || undefined}
              />
            ))}
          </Group>
        </>
      )}
    </div>
  );
}
