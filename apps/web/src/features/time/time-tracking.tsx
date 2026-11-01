import { addDays, startOfLocalDay, startOfWeek } from "@tick-taka/shared/dates";
import { MoreHorizontal, Pencil, Plus, Timer, Trash2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { ListSection } from "@/components/ui/list-section";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { SkeletonRows } from "@/components/ui/skeleton";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useNow } from "@/features/timer/use-now";
import { formatClock, formatLocalDate, formatMinutes, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreas } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { type TimeEntry, useTimeEntries } from "./queries";
import { TIME_VIEWS, type TimeView } from "./time-search";
import { entriesByDay, minutesByArea, minutesOf } from "./time-totals";
import { TimerCard } from "./timer-card";

function EntryRow({
  entry,
  title,
  timeZone,
}: {
  entry: TimeEntry;
  title: string;
  timeZone: string;
}) {
  const open = useOpenPanel();
  const edit = () => open(`time-entry:${entry.id}`);
  const del = () => void remove(`/time-entries/${entry.id}`, `“${title}”`).catch(() => {});
  return (
    <Row
      as="li"
      dataKey={`time-entry:${entry.id}`}
      keyActions={{ remove: del }}
      title={
        <>
          {entry.source === "focus" ? (
            <>
              <span aria-hidden>🌱 </span>
              <span className="sr-only">Focus session: </span>
            </>
          ) : null}
          {title}
          {entry.billable ? <span className="text-muted"> · 💵 Billable</span> : null}
        </>
      }
      onClick={edit}
      trailing={
        <>
          <span className="text-callout text-muted tabular">
            {formatClock(entry.startedAt, timeZone)} · {formatMinutes(minutesOf(entry, Date.now()))}
          </span>
          <Menu
            items={[
              { label: "Edit", icon: Pencil, onSelect: edit },
              "separator",
              { label: "Delete", icon: Trash2, danger: true, shortcut: "Del", onSelect: del },
            ]}
            trigger={
              <IconButton
                icon={MoreHorizontal}
                label={`More for ${title}`}
                size="sm"
                tooltip={false}
                className="[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
              />
            }
          />
        </>
      }
    />
  );
}

/**
 * Start/stop timer or manual entry, per area, with a billable flag: the week at a
 * glance (hours, focus, billable, top area), hours by area, then entries by day with
 * each day's total. "Focus only" swaps in the focus sessions' chart (`FocusStats`).
 */
export function TimeTracking({ onView }: { onView: (view: TimeView) => void }) {
  const open = useOpenPanel();
  const { timeZone, weekStartsOn } = useUserTime();
  const { data: areas = [] } = useAreas();
  const today = useTodayDate();
  const weekStart = startOfWeek(today, weekStartsOn);
  const entries = useTimeEntries(
    startOfLocalDay(weekStart, timeZone),
    startOfLocalDay(addDays(weekStart, 7), timeZone),
  );
  const now = useNow(60_000);
  const areaOf = (id: string | null) => areas.find((a) => a.id === id);
  const list = (entries.data ?? []).filter((e) => e.endedAt !== null);
  const byArea = minutesByArea(list, now);
  const most = byArea[0]?.[1] ?? 0;
  const total = byArea.reduce((sum, [, minutes]) => sum + minutes, 0);
  const days = entriesByDay(list, timeZone);
  const focusList = list.filter((e) => e.source === "focus");
  const focusMinutes = focusList.reduce((sum, e) => sum + minutesOf(e, now), 0);
  const billableMinutes = list
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + minutesOf(e, now), 0);
  const top = byArea[0];
  const topArea = top ? areaOf(top[0]) : undefined;
  const logTime = () => open("time-entry:new");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Time"
        subtitle="Where this week's hours went"
        actions={<Segmented label="Show" options={TIME_VIEWS} value="all" onChange={onView} />}
        primary={{ label: "Log time", icon: Plus, onClick: logTime }}
        summary={
          <SummaryStrip label="This week's time">
            <StatTile
              label="This week"
              tone="time"
              value={formatMinutes(total)}
              caption={plural(list.length, "entry", "entries")}
              loading={!entries.data}
            />
            <StatTile
              label="Focus"
              tone="time"
              value={formatMinutes(focusMinutes)}
              caption={
                focusList.length ? plural(focusList.length, "focus session") : "No sessions yet"
              }
              loading={!entries.data}
            />
            <StatTile
              label="Billable"
              value={formatMinutes(billableMinutes)}
              caption={
                billableMinutes && total
                  ? `${Math.round((billableMinutes / total) * 100)}% of the week`
                  : "None this week"
              }
              loading={!entries.data}
            />
            <StatTile
              label="Top area"
              value={top ? (topArea ? `${topArea.emoji} ${topArea.name}` : "No area") : "None yet"}
              caption={top ? formatMinutes(top[1]) : "Log time to see"}
              loading={!entries.data}
            />
          </SummaryStrip>
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-7 lg:order-2">
          <TimerCard />
          <Section
            id="time-by-area"
            title="This week by area"
            caption={list.length ? `${formatMinutes(total)} in all` : undefined}
          >
            {entries.isError && !entries.data ? (
              <ErrorState onRetry={() => void entries.refetch()} />
            ) : !entries.data ? (
              <SkeletonRows rows={3} />
            ) : list.length === 0 ? (
              <EmptyState
                icon={Timer}
                title="No time tracked yet"
                message="Start a timer or log time by hand to see where this week's hours go."
                actionLabel="Log time"
                onAction={logTime}
              />
            ) : (
              <Group as="ul" label="This week by area">
                {byArea.map(([id, minutes]) => {
                  const area = areaOf(id);
                  return (
                    <li key={id ?? "none"} className="flex flex-col gap-1.5 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate text-body">
                          {area ? `${area.emoji} ${area.name}` : "No area"}
                        </span>
                        <span className="text-body font-bold tabular">
                          {formatMinutes(minutes)}
                        </span>
                      </div>
                      <ProgressBar value={most ? minutes / most : 0} tone="sky" className="h-1.5" />
                    </li>
                  );
                })}
              </Group>
            )}
          </Section>
        </div>
        <div className="flex flex-col gap-6 lg:order-1">
          {days.map(([day, dayEntries]) => (
            <ListSection
              key={day}
              id={`time-${day}`}
              title={
                day === today
                  ? `Today · ${formatLocalDate(day, "long")}`
                  : formatLocalDate(day, "long")
              }
              total={formatMinutes(dayEntries.reduce((sum, e) => sum + minutesOf(e, now), 0))}
            >
              <Group as="ul" label={formatLocalDate(day, "long")}>
                {dayEntries.map((entry) => (
                  <EntryRow
                    key={entry.id}
                    entry={entry}
                    timeZone={timeZone}
                    title={entry.note || areaOf(entry.areaId)?.name || "Time"}
                  />
                ))}
              </Group>
            </ListSection>
          ))}
          {entries.data ? null : <SkeletonRows rows={4} />}
        </div>
      </div>
    </div>
  );
}
