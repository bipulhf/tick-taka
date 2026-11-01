import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { formatMinutes, plural } from "@/lib/format";
import { useAreaSummaries } from "./queries";

/**
 * The area page's strip: hours this week, money spent and earned this month, open
 * tasks. Amounts follow Hide amounts and Bangla digits.
 */
export function AreaSummary({ areaId, projects }: { areaId: string; projects?: number }) {
  const summaries = useAreaSummaries();
  if (summaries.isError && !summaries.data) return null;
  const row = summaries.data?.find((r) => r.area.id === areaId);
  if (summaries.data && !row) return null;
  const loading = !row;
  return (
    <SummaryStrip label="This area at a glance">
      <StatTile
        label="This week"
        tone="time"
        value={formatMinutes(row?.weekMinutes ?? 0)}
        caption="Time tracked"
        loading={loading}
      />
      <StatTile
        label="Spent this month"
        tone="out"
        minor={row?.monthSpentMinor ?? 0}
        caption="Tagged to this area"
        loading={loading}
      />
      <StatTile
        label="Earned this month"
        tone="in"
        minor={row?.monthIncomeMinor ?? 0}
        caption={row?.monthIncomeMinor ? "Tagged to this area" : "Nothing yet"}
        loading={loading}
      />
      <StatTile
        label="Open tasks"
        value={row?.openTasks ?? 0}
        caption={
          projects === undefined
            ? undefined
            : projects
              ? `In ${plural(projects, "active project")} and loose`
              : "No projects yet"
        }
        loading={loading}
      />
    </SummaryStrip>
  );
}
