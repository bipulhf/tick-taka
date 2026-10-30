import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SkeletonRows } from "@/components/ui/skeleton";
import { areaColorValue } from "@/features/plan/area-panel";
import { formatMinutes } from "@/lib/format";
import { useOpenPanel } from "@/lib/panel";
import { useAreaDashboard } from "./queries";

const COLUMNS = "sm:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem_1rem]";

/** One figure with its label above it; the label repeats in each row on a phone. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:items-end">
      <span className="text-caption text-muted sm:sr-only">{label}</span>
      <span className="text-body font-bold tabular">{children}</span>
    </div>
  );
}

/** For each area: hours this week, money in and out this month, open tasks. */
export function AreaDashboard() {
  const open = useOpenPanel();
  const dashboard = useAreaDashboard();
  const data = dashboard.data;
  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Areas"
        subtitle="How each part of life is going"
        back={{ to: "/review", label: "Review" }}
      />
      {!data ? (
        dashboard.isError ? (
          <ErrorState onRetry={() => void dashboard.refetch()} />
        ) : (
          <div role="status" aria-label="Loading">
            <SkeletonRows rows={4} />
          </div>
        )
      ) : data.length === 0 ? (
        <EmptyState
          title="No areas yet"
          message="Add areas like Work or Home to see each part of life here."
          actionLabel="Set up areas"
          onAction={() => open("area:new")}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl bg-card">
          <div
            aria-hidden
            className={`hidden gap-4 border-b border-line px-5 py-2.5 text-caption text-muted sm:grid ${COLUMNS}`}
          >
            <span>Area</span>
            <span className="text-right">This week</span>
            <span className="text-right">In this month</span>
            <span className="text-right">Out this month</span>
            <span />
          </div>
          <ul className="[&>*+*]:border-t [&>*+*]:border-line">
            {data.map((row) => (
              <li key={row.area.id}>
                <Link
                  to="/plan/area/$id"
                  params={{ id: row.area.id }}
                  className={`group grid grid-cols-3 items-center gap-x-4 gap-y-3 px-5 py-4 transition-colors hover:bg-line/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-text focus-visible:ring-inset ${COLUMNS}`}
                >
                  <div className="col-span-3 flex min-w-0 items-center gap-3 sm:col-span-1">
                    <span
                      aria-hidden
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: areaColorValue(row.area.color) }}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-body font-bold">
                        {row.area.emoji} {row.area.name}
                      </span>
                      <span className="block text-caption text-muted">{row.openTasks} open</span>
                    </span>
                  </div>
                  <Figure label="Week">{formatMinutes(row.weekMinutes)}</Figure>
                  <Figure label="In">
                    <Amount minor={row.monthIncomeMinor} animate={false} />
                  </Figure>
                  <Figure label="Out">
                    <Amount minor={row.monthSpentMinor} animate={false} />
                  </Figure>
                  <ChevronRight aria-hidden className="hidden size-4 text-muted sm:block" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
