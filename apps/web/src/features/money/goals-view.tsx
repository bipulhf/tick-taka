import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, RowMark } from "@/components/ui/group";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useRowKeyActions } from "@/lib/row-keys";
import { remove } from "@/lib/write";
import { GoalContribute } from "./goal-contribute";
import { RowMenu } from "./money-ui";
import { type Goal, useGoals } from "./queries";

function GoalItem({
  goal,
  adding,
  onAdd,
}: {
  goal: Goal;
  adding: boolean;
  onAdd: (open: boolean) => void;
}) {
  const open = useOpenPanel();
  const edit = () => open(`goal:${goal.id}`);
  const drop = () => void remove(`/goals/${goal.id}`, `“${goal.name}”`).catch(() => {});
  useRowKeyActions(`goal:${goal.id}`, { remove: drop });
  return (
    <div data-row={`goal:${goal.id}`} className="group/row flex flex-col gap-2.5 px-4 py-3.5">
      <div className="relative flex items-center gap-3">
        <RowMark emoji={goal.emoji} />
        <div className="min-w-0 flex-1">
          <button
            type="button"
            data-row-primary
            onClick={edit}
            className="block w-full truncate text-left text-body font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-xl after:focus-visible:ring-2 after:focus-visible:ring-sky-text"
          >
            {goal.name}
          </button>
          <p className="truncate text-callout text-muted">
            <Amount minor={goal.savedMinor} animate={false} className="font-semibold text-ink" /> of{" "}
            <Amount minor={goal.targetMinor} animate={false} />
            {goal.deadline ? ` · by ${formatLocalDate(goal.deadline)}` : ""}
          </p>
        </div>
        {goal.reached ? (
          <span role="img" aria-label="Reached" className="text-xl">
            🎉
          </span>
        ) : null}
        <div className="relative z-10">
          <RowMenu
            label={`More for ${goal.name}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: edit },
              { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
            ]}
          />
        </div>
      </div>
      <div className="flex flex-col gap-2.5 sm:pl-12">
        <ProgressBar value={goal.progress} tone="mint" label={`${goal.name} saved`} />
        {goal.suggestedMonthlyMinor ? (
          <p className="text-caption text-muted">
            Put aside{" "}
            <Amount minor={goal.suggestedMonthlyMinor} animate={false} className="text-ink" /> a
            month to stay on pace.
          </p>
        ) : null}
        {adding ? (
          <div className="flex flex-col gap-2 pt-1">
            <GoalContribute goal={goal} autoFocus onDone={() => onAdd(false)} />
            <Button size="sm" variant="ghost" className="self-start" onClick={() => onAdd(false)}>
              Cancel
            </Button>
          </div>
        ) : !goal.reached ? (
          <Button size="sm" className="self-start" onClick={() => onAdd(true)}>
            Add money
          </Button>
        ) : null}
      </div>
    </div>
  );
}

/** Savings jars with a target, an optional deadline and a suggested monthly amount. */
export function GoalsView() {
  const open = useOpenPanel();
  const goals = useGoals();
  const [adding, setAdding] = useState<string | null>(null);
  const create = () => open("goal:new");
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Goals"
        actions={
          <Button size="sm" icon={Plus} onClick={create}>
            New
          </Button>
        }
      />
      {goals.data === undefined ? (
        goals.isError ? (
          <ErrorState onRetry={() => void goals.refetch()} />
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : goals.data.length === 0 ? (
        <EmptyState
          title="No goals yet"
          message="Saving becomes a finishable project."
          actionLabel="Start a jar"
          onAction={create}
        />
      ) : (
        <Group label="Goals">
          {goals.data.map((goal) => (
            <GoalItem
              key={goal.id}
              goal={goal}
              adding={adding === goal.id}
              onAdd={(on) => setAdding(on ? goal.id : null)}
            />
          ))}
        </Group>
      )}
    </div>
  );
}
