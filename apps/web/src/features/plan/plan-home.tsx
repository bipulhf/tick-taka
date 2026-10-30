import { useNavigate } from "@tanstack/react-router";
import { addDays, endOfLocalDay, startOfLocalDay } from "@tick-taka/shared/dates";
import { CalendarRange, Inbox, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TaskRow } from "@/features/tasks/task-row";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { focusQuickAdd } from "@/lib/ui-state";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { groupByDay } from "./day-groups";
import { PlanAreas, PlanLinks } from "./plan-home-links";
import { useTasks } from "./queries";

/**
 * Plan: the inbox and the next two weeks side by side, then areas with their
 * projects and the other planning views.
 */
export function PlanHome() {
  const open = useOpenPanel();
  const navigate = useNavigate();
  const { timeZone } = useUserTime();
  const { data: areas = [] } = useAreas();
  const today = useTodayDate();
  const inbox = useTasks({ status: "inbox" });
  const upcoming = useTasks({
    status: "inbox,open",
    from: String(startOfLocalDay(addDays(today, 1), timeZone)),
    to: String(endOfLocalDay(addDays(today, 14), timeZone)),
  });
  const inboxTasks = (inbox.data ?? []).filter((t) => t.doAt === null);
  const days = groupByDay(upcoming.data ?? [], timeZone);
  const emoji = (areaId: string | null) => areas.find((a) => a.id === areaId)?.emoji;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Plan"
        actions={
          <Button variant="primary" icon={Plus} onClick={() => open("task:new")}>
            New task
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Section
          id="plan-inbox"
          title={inboxTasks.length ? `Inbox · ${inboxTasks.length}` : "Inbox"}
          caption="New tasks land here until they have a day"
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
                <TaskRow key={task.id} as="li" task={task} areaEmoji={emoji(task.areaId)} />
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
            <div className="flex flex-col gap-4">
              {days.map(([day, tasks]) => (
                <div key={day} className="flex flex-col gap-1.5">
                  <h3 className="px-1 text-callout font-bold text-muted">
                    {formatLocalDate(day, "long")}
                  </h3>
                  <Group as="ul" label={formatLocalDate(day, "long")}>
                    {tasks.map((task) => (
                      <TaskRow key={task.id} as="li" task={task} areaEmoji={emoji(task.areaId)} />
                    ))}
                  </Group>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PlanAreas />
        <PlanLinks />
      </div>
    </div>
  );
}
