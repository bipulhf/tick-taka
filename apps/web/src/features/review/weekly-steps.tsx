import { useNavigate } from "@tanstack/react-router";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { formatMinutes } from "@/lib/format";
import { BarList } from "./charts/bar-list";
import { habitStreakText, planShare, winLines } from "./gentle-progress";
import type { useWeeklyReview } from "./queries";

export type WeeklyData = NonNullable<ReturnType<typeof useWeeklyReview>["data"]>;

interface Named {
  id: string;
  name: string;
  emoji: string | null;
}

const nameOf = (item: Named | undefined, fallback: string) =>
  item ? `${item.emoji ?? ""} ${item.name}`.trim() : fallback;

/** Tracked time against the plan, per area. Over plan shows the extra, lighter, not as a miss. */
export function HoursStep({ data, areas }: { data: WeeklyData; areas: Named[] }) {
  if (data.hoursVsPlan.length === 0)
    return (
      <EmptyState
        title="No hours this week"
        message="Plan or track time this week and it shows up here."
        mood="relaxed"
      />
    );
  return (
    <ul className="flex flex-col gap-4 rounded-2xl bg-card p-5">
      {data.hoursVsPlan.map((row) => {
        const share = planShare(row.trackedMinutes, row.plannedMinutes);
        const name = nameOf(
          areas.find((a) => a.id === row.areaId),
          "No area",
        );
        return (
          <li key={row.areaId ?? "none"} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-body">{name}</span>
              <span className="text-caption text-muted tabular">
                {formatMinutes(row.trackedMinutes)} of {formatMinutes(row.plannedMinutes)} planned
                {share.extraMinutes ? ` · +${formatMinutes(share.extraMinutes)}` : ""}
              </span>
            </div>
            <div
              role="progressbar"
              aria-label={`${name}: ${formatMinutes(row.trackedMinutes)} of ${formatMinutes(row.plannedMinutes)} planned`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(share.filled * 100)}
              className="flex h-2.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full rounded-full bg-sky"
                style={{ width: `${share.filled * 100}%` }}
              />
              {share.extraMinutes ? <div className="h-full flex-1 bg-sky/40" /> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function SpendingStep({ data, categories }: { data: WeeklyData; categories: Named[] }) {
  const rows = data.spending.byCategory.slice(0, 5);
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-card p-5">
      <div>
        <Amount minor={data.spending.spentMinor} className="block text-title" animate={false} />
        <p className="text-callout text-muted">
          against a flexible weekly share of{" "}
          <Amount minor={data.spending.flexibleWeeklyBudgetMinor} animate={false} />
        </p>
      </div>
      {rows.length ? (
        <BarList
          label="Spending by category this week"
          tone="coral"
          items={rows.map((row) => ({
            key: row.categoryId ?? "none",
            label: nameOf(
              categories.find((c) => c.id === row.categoryId),
              "Uncategorised",
            ),
            value: row.amountMinor,
            valueText: <Amount minor={row.amountMinor} animate={false} />,
          }))}
        />
      ) : null}
    </div>
  );
}

export function HabitsStep({ data }: { data: WeeklyData }) {
  const navigate = useNavigate();
  if (data.habits.length === 0)
    return (
      <EmptyState
        title="No habits yet"
        message="Start one small habit and its streak will show up here."
        actionLabel="Add a habit"
        onAction={() => void navigate({ to: "/plan/habits" })}
      />
    );
  return (
    <Group>
      {data.habits.map((habit) => (
        <Row
          key={habit.id}
          leading={<span aria-hidden>{habit.emoji}</span>}
          title={habit.name}
          trailing={
            <span className="text-callout font-semibold text-grape-text tabular">
              {habitStreakText(habit.streak, habit.best, habit.unit)}
            </span>
          }
        />
      ))}
    </Group>
  );
}

export function WinsStep({ data }: { data: WeeklyData }) {
  const lines = winLines({
    ...data.wins,
    highlights: data.wins.highlights.length,
    formatMinutes,
  });
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-5">
      <ul className="flex flex-col gap-1.5">
        {lines.map((line) => (
          <li key={line} className="text-body">
            {line}
          </li>
        ))}
      </ul>
      {data.wins.highlights.length ? (
        <ul className="flex flex-col gap-1 border-t border-line pt-3">
          {data.wins.highlights.map((title) => (
            <li key={title} className="text-callout text-muted">
              • {title}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
