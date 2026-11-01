import { ArchiveRestore, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { FoldedSection } from "@/components/ui/folded-section";
import { Group, Row, RowMark } from "@/components/ui/group";
import { CardGrid, ItemCardSkeletons } from "@/components/ui/item-card";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { HabitCard } from "./habit-card";
import { habitTotals } from "./habit-progress";
import { useHabits } from "./queries";
import { archiveHabit } from "./use-archive-habit";

/**
 * Habits with streaks: today and this week at a glance, then each habit as a card with
 * its last seven days. Two freeze days a month keep one bad day from breaking a run.
 */
export function HabitList() {
  const open = useOpenPanel();
  const habits = useHabits();
  const all = useHabits({ archived: true });
  const list = habits.data ?? [];
  const archived = (all.data ?? []).filter((h) => h.archivedAt !== null);
  const add = () => open("habit:new");
  const totals = habitTotals(list);
  const weekPercent = totals.weekTarget
    ? Math.round((totals.weekDone / totals.weekTarget) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Habits"
        subtitle="Small repeated actions"
        primary={{ label: "New habit", icon: Plus, onClick: add }}
        summary={
          habits.data && list.length === 0 ? undefined : (
            <SummaryStrip label="Your habits">
              <StatTile
                label="Done today"
                value={`${totals.doneToday} of ${totals.total}`}
                caption={
                  totals.total && totals.doneToday === totals.total
                    ? "All done today"
                    : "Small steps count"
                }
                loading={!habits.data}
              />
              <StatTile
                label="This week"
                value={`${totals.weekDone} of ${totals.weekTarget}`}
                caption={
                  totals.weekDone ? `Days done so far, ${weekPercent}% of the week` : "A fresh week"
                }
                loading={!habits.data}
              />
              <StatTile
                label="Best streak going"
                value={
                  totals.best
                    ? `🔥 ${plural(totals.best.streak.current, totals.best.streak.unit)}`
                    : "A fresh start"
                }
                caption={totals.best ? totals.best.name : "Every streak starts with one day"}
                loading={!habits.data}
              />
            </SummaryStrip>
          )
        }
      />
      <Section
        id="habits-active"
        title="Active"
        caption="Two freeze days a month keep one missed day from breaking a streak"
      >
        {habits.isError && !habits.data ? (
          <ErrorState onRetry={() => void habits.refetch()} />
        ) : !habits.data ? (
          <ItemCardSkeletons count={3} />
        ) : list.length === 0 ? (
          <EmptyState
            title="No habits yet"
            message="Start with one tiny habit. Small steps, done often, add up."
            actionLabel="Add a habit"
            onAction={add}
          />
        ) : (
          <CardGrid label="Habits">
            {list.map((habit) => (
              <HabitCard key={habit.id} habit={habit} />
            ))}
          </CardGrid>
        )}
      </Section>
      {archived.length ? (
        <FoldedSection
          title="Archived"
          count={archived.length}
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
        </FoldedSection>
      ) : null}
    </div>
  );
}
