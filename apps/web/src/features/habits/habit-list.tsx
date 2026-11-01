import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row, RowMark } from "@/components/ui/group";
import { IconButton } from "@/components/ui/icon-button";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { SkeletonRows } from "@/components/ui/skeleton";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { remove } from "@/lib/write";
import { bestText, scheduleText, weekProgressText, weekTarget } from "./habit-progress";
import { type HabitWithProgress, useHabits } from "./queries";
import { archiveHabit } from "./use-archive-habit";

/** Days done this week, as dots: the week is counted up, never shown as days short. */
function WeekDots({ done, target }: { done: number; target: number }) {
  return (
    <span aria-hidden className="flex gap-1">
      {Array.from({ length: Math.min(7, target) }, (_, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed row of dots
          key={i}
          className={cx("size-2 rounded-full", i < done ? "bg-grape-text" : "bg-line")}
        />
      ))}
    </span>
  );
}

function HabitRow({ habit }: { habit: HabitWithProgress }) {
  const open = useOpenPanel();
  const target = weekTarget(habit.schedule, habit.perWeek);
  const best = bestText(habit.streak.best, habit.streak.unit);
  const deleteHabit = () => void remove(`/habits/${habit.id}`, `“${habit.name}”`).catch(() => {});
  return (
    <Row
      as="li"
      dataKey={`habit:${habit.id}`}
      keyActions={{ remove: deleteHabit }}
      className="min-h-[72px]"
      leading={<RowMark emoji={habit.emoji} tone="grape" />}
      title={habit.name}
      subtitle={
        <span className="flex flex-col gap-1 pt-0.5 whitespace-normal">
          <span>{scheduleText(habit.schedule, habit.perWeek, habit.targetCount)}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <WeekDots done={habit.weekDoneDays} target={target} />
            <span className="text-caption">
              {weekProgressText(habit.weekDoneDays, target, habit.schedule === "daily")} ·{" "}
              {plural(habit.streak.freezesLeftThisMonth, "freeze day")} left this month
            </span>
          </span>
        </span>
      }
      onClick={() => open(`habit:${habit.id}`)}
      trailing={
        <>
          <span className="flex flex-col items-end">
            {habit.streak.current > 0 ? (
              <span className="text-heading text-grape-text tabular">
                🔥 {habit.streak.current}
                <span className="sr-only">
                  {" "}
                  {habit.streak.unit === "week" ? "week" : "day"} streak
                </span>
              </span>
            ) : null}
            {best ? <span className="text-caption text-muted">{best}</span> : null}
          </span>
          <Menu
            items={[
              { label: "Edit", icon: Pencil, onSelect: () => open(`habit:${habit.id}`) },
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
        </>
      }
    />
  );
}

/** Habits with streaks; two freeze days a month keep one bad day from breaking a run. */
export function HabitList() {
  const open = useOpenPanel();
  const habits = useHabits();
  const all = useHabits({ archived: true });
  const list = habits.data ?? [];
  const archived = (all.data ?? []).filter((h) => h.archivedAt !== null);
  const add = () => open("habit:new");

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Habits"
        subtitle="Small repeated actions"
        actions={
          <Button variant="primary" icon={Plus} onClick={add}>
            New habit
          </Button>
        }
      />
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Section id="habits-active" title="Active">
          {habits.isError && !habits.data ? (
            <ErrorState onRetry={() => void habits.refetch()} />
          ) : !habits.data ? (
            <SkeletonRows rows={4} />
          ) : list.length === 0 ? (
            <EmptyState
              title="No habits yet"
              message="Start with one tiny habit. Small steps, done often, add up."
              actionLabel="Add a habit"
              onAction={add}
            />
          ) : (
            <Group as="ul" label="Habits">
              {list.map((habit) => (
                <HabitRow key={habit.id} habit={habit} />
              ))}
            </Group>
          )}
        </Section>
        <div className="flex flex-col gap-7">
          <Section id="habits-freeze" title="Freeze days">
            <p className="px-1 text-callout text-muted">
              Two freeze days a month keep one missed day from breaking a streak. They're spent on
              their own, only when a day is missed.
            </p>
          </Section>
          {archived.length ? (
            <Section
              id="habits-archived"
              title="Archived"
              caption="Hidden from Today, history kept"
            >
              <Group as="ul" label="Archived habits">
                {archived.map((habit) => (
                  <Row
                    key={habit.id}
                    as="li"
                    muted
                    leading={<RowMark emoji={habit.emoji} />}
                    title={habit.name}
                    trailing={
                      <Button
                        size="sm"
                        icon={ArchiveRestore}
                        onClick={() => archiveHabit(habit, false)}
                      >
                        Restore
                      </Button>
                    }
                  />
                ))}
              </Group>
            </Section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
