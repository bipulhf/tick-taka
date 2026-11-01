import { addDays, weekdayOf } from "@tick-taka/shared/dates";
import { Archive, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { ItemCard } from "@/components/ui/item-card";
import { Menu } from "@/components/ui/menu";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLocalDate, plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useTodayDate } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { bestText, lastDays, scheduleText, weekProgressText, weekTarget } from "./habit-progress";
import { type HabitWithProgress, useHabitLogs } from "./queries";
import { archiveHabit } from "./use-archive-habit";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const DAYS = 7;

/**
 * The last seven days as dots, today last: filled when done, a ring for part of a
 * day's target, a quiet dot when not. Read out as one line.
 */
function LastDays({ habit }: { habit: HabitWithProgress }) {
  const today = useTodayDate();
  const logs = useHabitLogs(habit.id, addDays(today, -(DAYS - 1)), today);
  if (!logs.data) return <Skeleton className="h-9 w-56" />;
  // Today's count from the list, which a tap on Today updates at once.
  const days = lastDays(logs.data, today, DAYS).map((day) =>
    day.date === today ? { ...day, count: habit.todayCount } : day,
  );
  const done = days.filter((d) => d.count >= habit.targetCount).length;
  return (
    <ol
      aria-label={`Done on ${plural(done, "day")} of the last ${DAYS}`}
      className="flex gap-2.5 sm:gap-3"
    >
      {days.map((day) => {
        const full = day.count >= habit.targetCount;
        return (
          <li
            key={day.date}
            title={`${formatLocalDate(day.date)}: ${day.count}/${habit.targetCount}`}
            className="flex flex-col items-center gap-1"
          >
            <span
              aria-hidden
              className={cx(
                "size-4 rounded-full",
                full
                  ? "bg-grape-text"
                  : day.count > 0
                    ? "border-2 border-grape-text"
                    : "border-2 border-line",
              )}
            />
            <span
              aria-hidden
              className={cx(
                "text-caption",
                day.date === today ? "font-extrabold text-ink" : "text-muted",
              )}
            >
              {LETTERS[weekdayOf(day.date)]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * One habit: its schedule, the streak, the last seven days as dots and how the week
 * is going, said by what was done. The card opens the habit.
 */
export function HabitCard({ habit }: { habit: HabitWithProgress }) {
  const open = useOpenPanel();
  const target = weekTarget(habit.schedule, habit.perWeek);
  const best = bestText(habit.streak.best, habit.streak.unit);
  const edit = () => open(`habit:${habit.id}`);
  const deleteHabit = () => void remove(`/habits/${habit.id}`, `“${habit.name}”`).catch(() => {});
  return (
    <ItemCard
      dataKey={`habit:${habit.id}`}
      keyActions={{ remove: deleteHabit }}
      onOpen={edit}
      leading={<RowMark emoji={habit.emoji} tone="grape" />}
      title={habit.name}
      subtitle={scheduleText(habit.schedule, habit.perWeek, habit.targetCount)}
      aside={
        habit.streak.current > 0 ? (
          <span className="text-heading text-grape-text tabular">
            🔥 {habit.streak.current}
            <span className="sr-only"> {habit.streak.unit === "week" ? "week" : "day"} streak</span>
          </span>
        ) : null
      }
      menu={
        <Menu
          items={[
            { label: "Edit", icon: Pencil, onSelect: edit },
            { label: "Archive", icon: Archive, onSelect: () => archiveHabit(habit) },
            "separator",
            {
              label: "Delete",
              icon: Trash2,
              danger: true,
              shortcut: "Del",
              onSelect: deleteHabit,
            },
          ]}
          trigger={
            <IconButton
              icon={MoreHorizontal}
              label={`More for ${habit.name}`}
              size="sm"
              tooltip={false}
              className="[@media(hover:hover)]:opacity-0 group-hover/row:opacity-100 group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100"
            />
          }
        />
      }
    >
      <LastDays habit={habit} />
      <p className="text-callout text-muted">
        {weekProgressText(habit.weekDoneDays, target, habit.schedule === "daily")}
        {best ? ` · ${best}` : ""}
        {" · "}
        {plural(habit.streak.freezesLeftThisMonth, "freeze day")} left
      </p>
    </ItemCard>
  );
}
