import { Plus } from "lucide-react";
import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { CardGrid, ItemCardSkeletons } from "@/components/ui/item-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { plural } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { DoneGoals, GoalCard } from "./goal-card";
import { goalTotals } from "./goal-money";
import { useGoals } from "./queries";

/**
 * Savings jars with a target, an optional deadline and a suggested monthly amount: the
 * totals first, then the open goals as cards; reached ones fold away under "Done".
 */
export function GoalsView() {
  const open = useOpenPanel();
  const goals = useGoals();
  const [adding, setAdding] = useState<string | null>(null);
  const create = () => open("goal:new");
  const list = goals.data ?? [];
  const isDone = (g: (typeof list)[number]) => g.reached || g.doneAt !== null;
  const active = list.filter((g) => !isDone(g));
  const done = list.filter(isDone);
  const totals = goalTotals(list);
  const percent = totals.targetMinor
    ? Math.floor((totals.savedMinor / totals.targetMinor) * 100)
    : 0;
  const loading = !goals.data;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Goals"
        primary={{ label: "New goal", icon: Plus, onClick: create }}
        summary={
          goals.data?.length === 0 ? undefined : (
            <SummaryStrip label="Your goals">
              <StatTile
                label="Total saved"
                tone="in"
                minor={totals.savedMinor}
                caption={`${Math.min(100, percent)}% of the target`}
                loading={loading}
              />
              <StatTile
                label="Total target"
                minor={totals.targetMinor}
                caption={`Across ${plural(list.length, "goal")}`}
                loading={loading}
              />
              <StatTile
                label="Put aside per month"
                minor={totals.monthlyMinor}
                caption={
                  totals.monthlyMinor ? "To stay on pace" : "Goals with a deadline get a pace"
                }
                loading={loading}
              />
            </SummaryStrip>
          )
        }
      />
      {goals.data === undefined ? (
        goals.isError ? (
          <ErrorState onRetry={() => void goals.refetch()} />
        ) : (
          <ItemCardSkeletons figure="ring" />
        )
      ) : list.length === 0 ? (
        <EmptyState
          title="No goals yet"
          message="Saving becomes a finishable project."
          actionLabel="Start a jar"
          onAction={create}
        />
      ) : (
        <>
          {active.length ? (
            <CardGrid label="Goals">
              {active.map((goal) => (
                <GoalCard
                  key={goal.id}
                  goal={goal}
                  adding={adding === goal.id}
                  onAdd={(on) => setAdding(on ? goal.id : null)}
                />
              ))}
            </CardGrid>
          ) : (
            <EmptyState
              title="Every goal reached"
              message="Start the next jar when you're ready."
              actionLabel="Start a jar"
              onAction={create}
              mood="relaxed"
            />
          )}
          <DoneGoals goals={done} />
        </>
      )}
    </div>
  );
}
