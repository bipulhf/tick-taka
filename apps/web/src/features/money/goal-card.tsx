import { toLocalDate } from "@tick-taka/shared/dates";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { Button } from "@/components/ui/button";
import { FoldedSection } from "@/components/ui/folded-section";
import { Group, Row, RowMark } from "@/components/ui/group";
import { ItemCard } from "@/components/ui/item-card";
import { Ring } from "@/components/ui/progress";
import { StatusPill } from "@/components/ui/status-pill";
import { formatLocalDate } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { remove } from "@/lib/write";
import { GoalContribute } from "./goal-contribute";
import { goalPace } from "./goal-money";
import { RowMenu } from "./money-ui";
import type { Goal } from "./queries";

function useGoalActions(goal: Goal) {
  const open = useOpenPanel();
  const edit = () => open(`goal:${goal.id}`);
  const drop = () => void remove(`/goals/${goal.id}`, `“${goal.name}”`).catch(() => {});
  const menu = (
    <RowMenu
      label={`More for ${goal.name}`}
      items={[
        { label: "Edit", icon: Pencil, onSelect: edit },
        { label: "Delete", icon: Trash2, onSelect: drop, danger: true, shortcut: "Del" },
      ]}
    />
  );
  return { edit, drop, menu };
}

/**
 * One open goal: a ring with the percent saved, saved of target, the deadline, a calm
 * On track / Behind pill, what to put aside a month to stay on pace, and Add money.
 */
export function GoalCard({
  goal,
  adding,
  onAdd,
}: {
  goal: Goal;
  adding: boolean;
  onAdd: (open: boolean) => void;
}) {
  const today = useTodayDate();
  const { timeZone } = useUserTime();
  const { edit, drop, menu } = useGoalActions(goal);
  const pace = goalPace(goal, toLocalDate(goal.createdAt, timeZone), today);
  const percent = Math.floor(goal.progress * 100);
  return (
    <ItemCard
      dataKey={`goal:${goal.id}`}
      keyActions={{ remove: drop }}
      onOpen={edit}
      leading={<RowMark emoji={goal.emoji} />}
      title={goal.name}
      subtitle={goal.deadline ? `By ${formatLocalDate(goal.deadline)}` : "No deadline"}
      aside={pace ? <StatusPill status={pace} /> : null}
      menu={menu}
      actions={
        adding ? (
          <>
            <GoalContribute goal={goal} autoFocus secondary onDone={() => onAdd(false)} />
            <Button size="sm" variant="ghost" className="self-start" onClick={() => onAdd(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <Button size="sm" icon={Plus} className="self-start" onClick={() => onAdd(true)}>
            Add money
          </Button>
        )
      }
    >
      <div className="flex items-center gap-4">
        <Ring value={goal.progress} size={72} stroke={7} tone="mint" label={`${percent}% saved`}>
          <span className="tabular text-callout font-bold">{percent}%</span>
        </Ring>
        <div className="min-w-0">
          <Amount minor={goal.savedMinor} animate={false} className="block text-title" />
          <p className="truncate text-callout text-muted">
            of <Amount minor={goal.targetMinor} animate={false} />
          </p>
        </div>
      </div>
      {goal.suggestedMonthlyMinor ? (
        <p className="text-callout text-muted">
          Put aside{" "}
          <Amount
            minor={goal.suggestedMonthlyMinor}
            animate={false}
            className="font-bold text-ink"
          />{" "}
          a month to stay on pace.
        </p>
      ) : null}
    </ItemCard>
  );
}

function DoneGoalRow({ goal }: { goal: Goal }) {
  const { edit, drop, menu } = useGoalActions(goal);
  return (
    <Row
      as="li"
      dataKey={`goal:${goal.id}`}
      keyActions={{ remove: drop }}
      onClick={edit}
      leading={<RowMark emoji={goal.emoji} />}
      title={goal.name}
      subtitle={
        <>
          Saved <Amount minor={goal.savedMinor} animate={false} />
        </>
      }
      trailing={
        <>
          <StatusPill status="done" />
          {menu}
        </>
      }
    />
  );
}

/** Reached goals, folded away at the end. */
export function DoneGoals({ goals }: { goals: Goal[] }) {
  if (goals.length === 0) return null;
  return (
    <FoldedSection title="Done" count={goals.length} caption="Reached. Well saved.">
      <Group as="ul" label="Done goals">
        {goals.map((goal) => (
          <DoneGoalRow key={goal.id} goal={goal} />
        ))}
      </Group>
    </FoldedSection>
  );
}
