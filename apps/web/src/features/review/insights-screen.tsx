import { monthOf, toLocalDate } from "@tick-taka/shared/dates";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { StatTile, SummaryStrip } from "@/components/ui/stat-tile";
import { useInsights } from "@/features/money/queries";
import { formatLocalDate, formatMinutes, formatMonth } from "@/lib/format";
import { useAreas, useCategories, useHourlyRate, useSettings } from "@/lib/queries";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { AreaRates, HoursByArea } from "./insights-areas";
import {
  areaStats,
  type Range,
  reportSpan,
  rollUpByParent,
  seriesMonths,
  spendingByDay,
  spendingByWeek,
} from "./insights-data";
import { CategorySpending, MonthlyFlow, NetWorth, SpendingOverTime } from "./insights-sections";

const RANGES: { value: Range; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "3 months" },
  { value: "year", label: "Year" },
];

/** "Sat 31 Oct to Fri 6 Nov", "Nov 2026", "Sep to Nov 2026". */
function spanText(range: Range, first: string, last: string): string {
  if (range === "week") return `${formatLocalDate(first)} to ${formatLocalDate(last)}`;
  if (range === "month") return formatMonth(monthOf(first));
  return `${formatMonth(monthOf(first))} to ${formatMonth(monthOf(last))}`;
}

/**
 * The period in numbers (earned, spent, net, hours), then every chart in the same
 * card: spending by category and over time, income against spending by month, net
 * worth, and hours, spending and hourly rate by area. The period in the header scopes
 * everything; the month-by-month charts show half a year (a year for Year).
 */
export function InsightsScreen() {
  const { timeZone } = useUserTime();
  const today = useTodayDate();
  const weekStartsOn = useSettings().data?.weekStartsOn;
  const [range, setRange] = useState<Range>("month");
  const span = reportSpan(range, today, timeZone, weekStartsOn);
  const summary = useInsights(span.from, span.to);
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const overall = useHourlyRate();
  const data = summary.data;
  const state = data ? "ready" : summary.isError ? "failed" : "loading";
  const retry = () => void summary.refetch();

  const ranked = rollUpByParent(data?.spendingByCategory ?? [], categories);
  const categoryName = (id: string | null) => {
    const category = categories.find((c) => c.id === id);
    return category ? `${category.emoji} ${category.name}` : "Uncategorised";
  };
  const byArea = areaStats(areas, data);
  const days = data ? spendingByDay(data.byDay, span, today, timeZone) : [];
  const weekly = range === "year";
  const minutes = data?.hoursByArea.reduce((sum, r) => sum + r.minutes, 0) ?? 0;
  const focus = data?.hoursByArea.reduce((sum, r) => sum + r.focusMinutes, 0) ?? 0;
  const first = toLocalDate(span.from, timeZone);
  const last = toLocalDate(span.to - 1, timeZone);
  const months = seriesMonths(range);

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="Reports"
        subtitle={spanText(range, first, last)}
        actions={<Segmented label="Period" value={range} onChange={setRange} options={RANGES} />}
        summary={
          <SummaryStrip label="This period">
            <StatTile
              label="Earned"
              tone="in"
              minor={data?.totals.incomeMinor}
              caption="Money in"
              loading={!data}
            />
            <StatTile
              label="Spent"
              tone="out"
              minor={data?.totals.spentMinor}
              caption="Money out"
              loading={!data}
            />
            <StatTile
              label="Net"
              tone="flow"
              minor={data?.totals.netMinor}
              caption="Earned minus spent"
              loading={!data}
            />
            <StatTile
              label="Hours tracked"
              tone="time"
              value={formatMinutes(minutes)}
              caption={focus ? `${formatMinutes(focus)} of it focus` : "Across every area"}
              loading={!data}
            />
          </SummaryStrip>
        }
      />
      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
        <CategorySpending ranked={ranked} name={categoryName} state={state} onRetry={retry} />
        <SpendingOverTime
          points={weekly ? spendingByWeek(days, weekStartsOn) : days}
          unit={weekly ? "week" : "day"}
          state={state}
          onRetry={retry}
        />
        <MonthlyFlow months={months} />
        <NetWorth months={months} />
        <HoursByArea rows={byArea} state={state} onRetry={retry} />
        <AreaRates
          rows={byArea}
          overallRate={overall.data?.rateMinor ?? null}
          state={state}
          onRetry={retry}
        />
      </div>
    </div>
  );
}
