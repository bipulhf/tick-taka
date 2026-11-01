import { addDays, startOfLocalDay, startOfWeek } from "@tick-taka/shared/dates";
import { Check, ChevronLeft, ChevronRight, Copy, Search } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { NONE, Select } from "@/components/ui/select";
import { SkeletonRows } from "@/components/ui/skeleton";
import { TextField } from "@/components/ui/text-field";
import { formatClock, formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { notify, notifyError } from "@/lib/toast";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { doneByDay, timesheetText } from "./day-groups";
import { useTasks } from "./queries";

/** Everything I finished; doubles as a timesheet when a job asks what I did. */
export function LogbookList() {
  const open = useOpenPanel();
  const { timeZone, weekStartsOn } = useUserTime();
  const { data: areas = [] } = useAreas();
  const today = useTodayDate();
  const [q, setQ] = useState("");
  const query = useDeferredValue(q.trim());
  const [areaId, setAreaId] = useState<string | null>(null);
  const [weeksBack, setWeeksBack] = useState(0);
  const weekStart = addDays(startOfWeek(today, weekStartsOn), -7 * weeksBack);
  const done = useTasks({
    status: "done",
    includeSubtasks: "true",
    doneFrom: String(startOfLocalDay(weekStart, timeZone)),
    doneTo: String(startOfLocalDay(addDays(weekStart, 7), timeZone)),
    ...(query ? { q: query } : {}),
    ...(areaId ? { areaId } : {}),
  });
  const days = doneByDay(done.data ?? [], timeZone);
  const count = days.reduce((sum, [, tasks]) => sum + tasks.length, 0);
  const area = areas.find((a) => a.id === areaId);

  const copyTimesheet = async () => {
    try {
      await navigator.clipboard.writeText(timesheetText(days, weekStart, area?.name));
      notify("Timesheet copied");
    } catch {
      notifyError("Couldn't copy the timesheet. Try again.");
    }
  };

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Logbook" subtitle={`Week of ${formatLocalDate(weekStart)}`} />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_300px]">
        <aside aria-label="Filters" className="flex flex-col gap-3 lg:sticky lg:top-0 lg:order-2">
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted"
            />
            <TextField
              aria-label="Search finished tasks"
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search finished tasks"
              className="[&_input]:pl-9"
            />
          </div>
          <Select
            ariaLabel="Area"
            value={areaId ?? NONE}
            onChange={(value) => setAreaId(value === NONE ? null : value)}
            options={[
              { value: NONE, label: "All areas" },
              ...areas.map((a) => ({ value: a.id, label: a.name, leading: a.emoji })),
            ]}
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              icon={ChevronLeft}
              className="flex-1"
              onClick={() => setWeeksBack(weeksBack + 1)}
            >
              Earlier
            </Button>
            <Button
              size="sm"
              className="flex-1"
              disabled={weeksBack === 0}
              onClick={() => setWeeksBack(weeksBack - 1)}
            >
              Later
              <ChevronRight aria-hidden className="size-4" />
            </Button>
          </div>
          <Button size="sm" icon={Copy} disabled={days.length === 0} onClick={copyTimesheet}>
            Copy as timesheet
          </Button>
          {done.data && count ? (
            <p className="px-1 text-caption text-muted">{plural(count, "task")} finished</p>
          ) : null}
        </aside>
        <div className="flex flex-col gap-6 lg:order-1">
          {done.isError && !done.data ? (
            <ErrorState onRetry={() => void done.refetch()} />
          ) : !done.data ? (
            <SkeletonRows rows={5} />
          ) : days.length === 0 ? (
            <EmptyState
              title={query ? "Nothing matches" : "Nothing finished this week yet"}
              message={
                query
                  ? "Try another word, or look at an earlier week."
                  : "Finished tasks gather here, so you can look back or share a timesheet."
              }
              mood="calm"
            />
          ) : (
            days.map(([day, tasks]) => (
              <section key={day} aria-labelledby={`log-${day}`} className="flex flex-col gap-1.5">
                <h2 id={`log-${day}`} className="px-1 text-callout font-bold text-muted">
                  {formatLocalDate(day, "long")}
                </h2>
                <Group as="ul" label={formatLocalDate(day, "long")}>
                  {tasks.map((task) => (
                    <Row
                      key={task.id}
                      as="li"
                      dataKey={`task:${task.id}`}
                      leading={<RowMark icon={Check} tone="sky" size="sm" />}
                      title={task.title}
                      subtitle={areas.find((a) => a.id === task.areaId)?.name}
                      onClick={() => open(`task:${task.id}`)}
                      trailing={
                        <span className="text-caption text-muted tabular">
                          {task.doneAt !== null ? formatClock(task.doneAt, timeZone) : null}
                        </span>
                      }
                    />
                  ))}
                </Group>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
