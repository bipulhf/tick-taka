import { Link } from "@tanstack/react-router";
import { PieChart } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState } from "@/components/ui/empty-state";
import { Group } from "@/components/ui/group";
import { ProgressBar } from "@/components/ui/progress";
import { SkeletonRows } from "@/components/ui/skeleton";
import { useOpenPanel } from "@/lib/panel";
import { useThisMonth } from "@/lib/use-today";
import { BUCKETS, bucketLines, bucketShown, noBudgets } from "./budget-lines";
import { useBudgets } from "./queries";

/** This month's three budget groups at a glance: spent of the limit, with a bar. */
export function BudgetsAtAGlance() {
  const month = useThisMonth();
  const budgets = useBudgets(month);
  const open = useOpenPanel();
  const data = budgets.data;
  if (!data) return <SkeletonRows rows={3} />;
  if (noBudgets(data.lines))
    return (
      <EmptyState
        icon={PieChart}
        title="No budgets yet"
        message="Give a few categories a monthly limit so you can spend without second-guessing."
        actionLabel="Set budgets"
        onAction={() => open(`budget:${month}`)}
      />
    );
  const shown = BUCKETS.filter((b) =>
    bucketShown(data.buckets[b.key], bucketLines(data.lines, b.key)),
  );
  return (
    <Group>
      {shown.map((bucket) => {
        const totals = data.buckets[bucket.key];
        const over = totals.availableMinor < 0;
        return (
          <Link
            key={bucket.key}
            to="/money/budgets"
            className="flex flex-col gap-2 px-4 py-3 hover:bg-line/30"
          >
            <span className="flex items-baseline justify-between gap-3">
              <span className="text-body font-semibold">{bucket.title}</span>
              <span className="text-callout text-muted">
                <Amount minor={totals.spentMinor} animate={false} className="font-bold text-ink" />{" "}
                of <Amount minor={totals.limitMinor} animate={false} />
              </span>
            </span>
            <ProgressBar
              value={totals.limitMinor ? totals.spentMinor / totals.limitMinor : 0}
              tone={over ? "coral" : "mint"}
              label={`${bucket.title} spent of its budget`}
            />
            {over ? (
              <span className="text-caption text-coral-text">
                Over by <Amount minor={-totals.availableMinor} animate={false} />
              </span>
            ) : null}
          </Link>
        );
      })}
    </Group>
  );
}
