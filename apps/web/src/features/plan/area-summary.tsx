import { Amount } from "@/components/ui/amount";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMinutes } from "@/lib/format";
import { useAreaSummaries } from "./queries";

/**
 * The area page's one-line summary: hours this week, money spent (and earned, when
 * there is some) this month, open tasks. Amounts hide with Hide amounts.
 */
export function AreaSummary({ areaId }: { areaId: string }) {
  const summaries = useAreaSummaries();
  if (!summaries.data)
    return summaries.isError ? null : <Skeleton className="mt-1 inline-block h-4 w-72" />;
  const row = summaries.data.find((r) => r.area.id === areaId);
  if (!row) return null;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      <span>
        <span className="font-bold text-sky-text tabular">{formatMinutes(row.weekMinutes)}</span>{" "}
        this week
      </span>
      <span>
        <Amount minor={row.monthSpentMinor} tone="out" animate={false} className="font-bold" />{" "}
        spent this month
      </span>
      {row.monthIncomeMinor > 0 ? (
        <span>
          <Amount minor={row.monthIncomeMinor} tone="in" animate={false} className="font-bold" />{" "}
          earned
        </span>
      ) : null}
      <span>
        <span className="font-bold text-ink tabular">{row.openTasks}</span>{" "}
        {row.openTasks === 1 ? "open task" : "open tasks"}
      </span>
    </span>
  );
}
