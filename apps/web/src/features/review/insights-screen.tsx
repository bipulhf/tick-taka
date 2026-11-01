import { useState } from "react";
import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Section } from "@/components/ui/section";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { useInsights } from "@/features/money/queries";
import { useAreas, useCategories, useHourlyRate } from "@/lib/queries";
import { useThisMonth, useTodayDate, useUserTime } from "@/lib/use-today";
import { areaStats, type Range, reportSpan, rollUpByParent, spendingByDay } from "./insights-data";
import {
  AreaRows,
  CategorySpending,
  DailySpending,
  HoursByArea,
  MonthlyFlow,
  NetWorth,
  SectionSkeleton,
} from "./insights-sections";

const RANGES: { value: Range; label: string }[] = [
  { value: "this", label: "This month" },
  { value: "last", label: "Last month" },
  { value: "quarter", label: "3 months" },
];

/**
 * Spending by category and by day, income against spending by month, net worth,
 * and hours, spending and hourly rate by area. The period above scopes everything
 * that follows it except the month-by-month charts, which always show half a year.
 */
export function InsightsScreen() {
  const { timeZone } = useUserTime();
  const month = useThisMonth();
  const today = useTodayDate();
  const [range, setRange] = useState<Range>("this");
  const span = reportSpan(range, month, timeZone);
  const summary = useInsights(span.from, span.to);
  const { data: categories = [] } = useCategories();
  const { data: areas = [] } = useAreas();
  const overall = useHourlyRate();
  const data = summary.data;

  const ranked = rollUpByParent(data?.spendingByCategory ?? [], categories);
  const categoryName = (id: string | null) => {
    const category = categories.find((c) => c.id === id);
    return category ? `${category.emoji} ${category.name}` : "Uncategorised";
  };
  const byArea = areaStats(areas, data);
  const days = data ? spendingByDay(data.byDay, span, today, timeZone) : [];
  const failed = summary.isError && !data;

  return (
    <div className="flex flex-col gap-7">
      <PageHeader title="Reports" />
      <div className="flex flex-col gap-4">
        <Segmented
          label="Period"
          value={range}
          onChange={setRange}
          options={RANGES}
          className="self-start"
        />
        {data ? (
          <p className="px-1 text-heading">
            <Amount minor={data.totals.incomeMinor} tone="in" animate={false} /> in,{" "}
            <Amount minor={data.totals.spentMinor} tone="out" animate={false} /> out
            <span className="text-muted"> · net </span>
            <Amount minor={data.totals.netMinor} signed animate={false} />
          </p>
        ) : failed ? null : (
          <Skeleton className="h-7 w-80" />
        )}
      </div>
      {failed ? <ErrorState onRetry={() => void summary.refetch()} /> : null}
      <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-8">
        <Section title="Spending by category">
          {!data ? (
            failed ? null : (
              <SectionSkeleton />
            )
          ) : ranked.length === 0 ? (
            <EmptyState
              title="No spending in this range"
              message="Spending you log in this period shows up here."
              mood="relaxed"
            />
          ) : (
            <CategorySpending ranked={ranked} name={categoryName} />
          )}
        </Section>
        <Section title="Spending by day">
          {!data ? (
            failed ? null : (
              <Skeleton className="h-60 rounded-2xl" />
            )
          ) : days.length === 0 || ranked.length === 0 ? (
            <EmptyState
              title="No spending in this range"
              message="Spending you log in this period shows up here."
              mood="relaxed"
            />
          ) : (
            <DailySpending days={days} />
          )}
        </Section>
        <MonthlyFlow />
        <NetWorth />
        <Section title="Hours by area">
          {!data ? failed ? null : <SectionSkeleton rows={3} /> : <HoursByArea rows={byArea} />}
        </Section>
        <Section title="By area">
          {!data ? (
            failed ? null : (
              <SectionSkeleton rows={3} />
            )
          ) : byArea.length === 0 ? (
            <EmptyState
              title="Nothing by area yet"
              message="Tag time and spending with an area to compare them here."
            />
          ) : (
            <AreaRows rows={byArea} overallRate={overall.data?.rateMinor ?? null} />
          )}
        </Section>
      </div>
    </div>
  );
}
