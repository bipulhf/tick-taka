import { useNavigate } from "@tanstack/react-router";
import {
  addDays,
  endOfLocalDay,
  startOfLocalDay,
  startOfWeek,
  toLocalDate,
} from "@tick-taka/shared/dates";
import { CalendarRange, Inbox, Plus } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ListSection } from "@/components/ui/list-section";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { TaskRow, type TriageAction } from "@/features/tasks/task-row";
import { formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { focusQuickAdd } from "@/lib/ui-state";
import { useToday, useTodayDate, useUserTime } from "@/lib/use-today";
import { groupByDay, plannedMinutes } from "./day-groups";
import { PlanAreas } from "./plan-home-links";
import { type PlanTask, useTasks } from "./queries";
import { useMoveTask } from "./use-move-task";

/** "3 tasks · 1h 30m": a day's count and the time its open tasks ask for. */
const dayLoad = (tasks: PlanTask[]) =>
  `${plural(tasks.length, "task")} · ${formatMinutes(plannedMinutes(tasks))}`;

/**
 * Plan: how the day and the week look (left today, overdue, inbox, planned this week),
 * then the inbox with quick moves beside the next two weeks by day, then the areas.
 */
export function PlanHome() {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const { timeZone, weekStartsOn } = useUserTime();
  const { data: areas = [] } = useAreas();
  const today = useTodayDate();
  const day = useToday();
  const move = useMoveTask(timeZone);
  const weekEnd = addDays(startOfWeek(today, weekStartsOn), 6);
  const inbox = useTasks({ status: "inbox" });
  const upcoming = useTasks({
    status: "inbox,open",
    from: String(startOfLocalDay(addDays(today, 1), timeZone)),
    to: String(endOfLocalDay(addDays(today, 14), timeZone)),
  });
  const restOfWeek = useTasks({
    status: "inbox,open",
    from: String(startOfLocalDay(today, timeZone)),
    to: String(endOfLocalDay(weekEnd, timeZone)),
  });
  // A task given a day or parked leaves the inbox at once.
  const inboxTasks = (inbox.data ?? []).filter((t) => t.doAt === null && t.status === "inbox");
  const days = groupByDay(upcoming.data ?? [], timeZone);
  const week = (restOfWeek.data ?? []).filter((t) => t.status !== "done" && t.doAt !== null);
  const leftToday = week.filter((t) => t.doAt !== null && toLocalDate(t.doAt, timeZone) === today);
  const overdue = day.data?.counts.overdue ?? 0;
  const emoji = (areaId: string | null) => areas.find((a) => a.id === areaId)?.emoji;
  const triage = (task: PlanTask): TriageAction[] => [
    { label: "Today", onSelect: () => move.toDay(task, today) },
    { label: "Tomorrow", onSelect: () => move.toDay(task, addDays(today, 1)) },
    { label: "Someday", onSelect: () => move.toSomeday(task) },
  ];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Plan"
        primary={{ label: "New task", icon: Plus, onClick: () => open("task:new") }}
        summary={
          <SummaryStrip label="Your plan">
            <StatTile
              label="Left today"
              tone="time"
              value={leftToday.length}
              caption={
                leftToday.length
                  ? `${formatMinutes(plannedMinutes(leftToday))} planned`
                  : "Nothing left for today"
              }
              loading={!restOfWeek.data}
            />
            <StatTile
              label="Overdue"
              value={overdue}
              caption={overdue ? "Move when ready" : "Nothing behind"}
              loading={!day.data}
            />
            <StatTile
              label="Inbox"
              value={inboxTasks.length}
              caption={inboxTasks.length ? "Waiting for a day" : "All sorted"}
              loading={!inbox.data}
            />
            <StatTile
              label="Planned this week"
              tone="time"
              value={formatMinutes(plannedMinutes(week))}
              caption={`${plural(week.length, "task")} to ${formatLocalDate(weekEnd)}`}
              loading={!restOfWeek.data}
            />
          </SummaryStrip>
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section
          id="plan-inbox"
          title={inboxTasks.length ? `Inbox · ${inboxTasks.length}` : "Inbox"}
          caption="Give each one a day, or park it for someday"
        >
          {inbox.isError && !inbox.data ? (
            <ErrorState onRetry={() => void inbox.refetch()} />
          ) : !inbox.data ? (
            <SkeletonRows rows={4} />
          ) : inboxTasks.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="Inbox zero"
              message="Everything has a home. New ideas land here first."
              actionLabel="Capture something"
              onAction={focusQuickAdd}
            />
          ) : (
            <Group as="ul" label="Inbox">
              {inboxTasks.map((task) => (
                <TaskRow
                  key={task.id}
                  as="li"
                  task={task}
                  areaEmoji={emoji(task.areaId)}
                  triage={triage(task)}
                />
              ))}
            </Group>
          )}
        </Section>
        <Section id="plan-upcoming" title="Upcoming" caption="The next two weeks">
          {upcoming.isError && !upcoming.data ? (
            <ErrorState onRetry={() => void upcoming.refetch()} />
          ) : !upcoming.data ? (
            <SkeletonRows rows={4} />
          ) : days.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="Nothing planned yet"
              message="The next two weeks are open. Give a few tasks a day."
              actionLabel="Open the week"
              onAction={() => void navigate({ to: "/plan/week" })}
            />
          ) : (
            <div className="flex flex-col gap-5">
              {days.map(([date, tasks]) => (
                <ListSection
                  key={date}
                  id={`upcoming-${date}`}
                  title={
                    date === addDays(today, 1)
                      ? `Tomorrow · ${formatLocalDate(date, "long")}`
                      : formatLocalDate(date, "long")
                  }
                  total={dayLoad(tasks)}
                >
                  <Group as="ul" label={formatLocalDate(date, "long")}>
                    {tasks.map((task) => (
                      <TaskRow key={task.id} as="li" task={task} areaEmoji={emoji(task.areaId)} />
                    ))}
                  </Group>
                </ListSection>
              ))}
            </div>
          )}
        </Section>
      </div>
      <PlanAreas />
    </div>
  );
}
