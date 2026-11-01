import { useNavigate } from "@tanstack/react-router";
import { addDays, startOfLocalDay, startOfWeek } from "@tick-taka/shared/dates";
import { ChevronLeft, ChevronRight, Sprout } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { useAreas } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { useFocusStats } from "./queries";
import { TIME_VIEWS, type TimeView } from "./time-search";
import { WeekBars } from "./week-bars";

/**
 * Time's "Focus only" view: weekly focus minutes per day and per area, e.g. how much
 * deep work Research got.
 */
export function FocusStats({ onView }: { onView: (view: TimeView) => void }) {
  const navigate = useNavigate();
  const { timeZone, weekStartsOn } = useUserTime();
  const { data: areas = [] } = useAreas();
  const today = useTodayDate();
  const [weeksBack, setWeeksBack] = useState(0);
  const weekStart = addDays(startOfWeek(today, weekStartsOn), -7 * weeksBack);
  const stats = useFocusStats(
    startOfLocalDay(weekStart, timeZone),
    startOfLocalDay(addDays(weekStart, 7), timeZone),
  );
  const data = stats.data;
  const bars = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return {
      key: day,
      label: formatLocalDate(day).slice(0, 3),
      name: formatLocalDate(day, "long"),
      value: Math.round(data?.byDay.find((d) => d.date === day)?.minutes ?? 0),
    };
  });
  const byArea = [...(data?.byArea ?? [])].sort((a, b) => b.minutes - a.minutes);
  const most = byArea[0]?.minutes ?? 0;
  const topArea = byArea[0] ? areas.find((a) => a.id === byArea[0]?.areaId) : undefined;
  const bestDay = bars.reduce<(typeof bars)[number] | null>(
    (best, bar) => (bar.value > (best?.value ?? 0) ? bar : best),
    null,
  );

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Time"
        subtitle={`Week of ${formatLocalDate(weekStart)}`}
        actions={
          <>
            <IconButton
              icon={ChevronLeft}
              label="Earlier week"
              onClick={() => setWeeksBack(weeksBack + 1)}
            />
            <IconButton
              icon={ChevronRight}
              label="Later week"
              disabled={weeksBack === 0}
              onClick={() => setWeeksBack(weeksBack - 1)}
            />
            <Segmented label="Show" options={TIME_VIEWS} value="focus" onChange={onView} />
          </>
        }
        summary={
          data?.sessions === 0 ? undefined : (
            <SummaryStrip label="Focus this week">
              <StatTile
                label="Focus"
                tone="time"
                value={formatMinutes(data?.totalMinutes ?? 0)}
                caption={plural(data?.sessions ?? 0, "focus session")}
                loading={!data}
              />
              <StatTile
                label="A session"
                value={
                  data?.sessions
                    ? formatMinutes(Math.round(data.totalMinutes / data.sessions))
                    : "0m"
                }
                caption="On average"
                loading={!data}
              />
              <StatTile
                label="Best day"
                value={bestDay ? formatLocalDate(bestDay.key) : "None yet"}
                caption={bestDay ? formatMinutes(bestDay.value) : "Start a session"}
                loading={!data}
              />
              <StatTile
                label="Top area"
                value={
                  byArea[0]
                    ? topArea
                      ? `${topArea.emoji} ${topArea.name}`
                      : "No area"
                    : "None yet"
                }
                caption={byArea[0] ? formatMinutes(byArea[0].minutes) : "Start a session"}
                loading={!data}
              />
            </SummaryStrip>
          )
        }
      />
      {stats.isError && !data ? (
        <ErrorState onRetry={() => void stats.refetch()} />
      ) : !data ? (
        <div
          role="status"
          aria-label="Loading"
          className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        >
          <Skeleton className="h-72 rounded-3xl" />
          <SkeletonRows rows={3} />
        </div>
      ) : data.sessions === 0 ? (
        <EmptyState
          title="No focus sessions this week"
          message="Each session lands here, so you can see where your deep work went."
          mood="calm"
          actionLabel="Start focusing"
          onAction={() => void navigate({ to: "/focus" })}
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Section id="focus-by-day" title="By day">
            <div className="rounded-2xl bg-card p-5">
              <WeekBars bars={bars} today={today} />
            </div>
          </Section>
          <Section id="focus-by-area" title="By area">
            <Group as="ul" label="By area">
              {byArea.map((row) => {
                const area = areas.find((a) => a.id === row.areaId);
                return (
                  <li key={row.areaId ?? "none"} className="flex flex-col gap-1.5 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-body">
                        {area ? `${area.emoji} ${area.name}` : "No area"}
                      </span>
                      <span className="text-body font-bold tabular">
                        {formatMinutes(row.minutes)}
                      </span>
                    </div>
                    <ProgressBar
                      value={most ? row.minutes / most : 0}
                      tone="sky"
                      className="h-1.5"
                    />
                  </li>
                );
              })}
            </Group>
            <p className="flex items-center gap-2 px-1 text-caption text-muted">
              <Sprout aria-hidden className="size-4 text-sky" />
              Only focus sessions count here; All shows every timer.
            </p>
          </Section>
        </div>
      )}
    </div>
  );
}
