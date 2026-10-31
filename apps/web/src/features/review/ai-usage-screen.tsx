import { useState } from "react";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { MonthStepper } from "@/components/ui/month-stepper";
import { PageHeader } from "@/components/ui/page-header";
import { ProgressBar } from "@/components/ui/progress";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { formatLocalDate, formatMonth, plural } from "@/lib/format";
import { useThisMonth } from "@/lib/use-today";
import { cents, costByDay, dollars, FEATURES, thousands } from "./ai-usage-format";
import { ColumnChart } from "./charts/column-chart";
import { useAiUsage } from "./queries";

const Value = ({ children }: { children: string }) => (
  <span className="text-callout font-bold tabular">{children}</span>
);

/**
 * What AI cost this month, by day and by feature, reached from Settings › Tiki and AI.
 * Cost per person is the owner's, in Admin › AI cost.
 */
export function AiUsageScreen() {
  const current = useThisMonth();
  const [month, setMonth] = useState(current);
  const usage = useAiUsage(month === current ? undefined : month);
  const report = usage.data;
  const empty = report && report.calls === 0;
  const days = report ? costByDay(month, report.byDay) : [];

  return (
    <div className="flex flex-col gap-7">
      <PageHeader
        title="AI cost"
        subtitle={formatMonth(month)}
        back={{ to: "/settings", label: "Settings", search: { section: "ai" } }}
        actions={<MonthStepper month={month} onChange={setMonth} max={current} />}
      />
      {!report ? (
        usage.isError ? (
          <ErrorState onRetry={() => void usage.refetch()} />
        ) : (
          <div role="status" aria-label="Loading" className="flex flex-col gap-7">
            <Skeleton className="h-32 rounded-3xl" />
            <SkeletonRows rows={3} />
          </div>
        )
      ) : empty ? (
        <EmptyState
          title="No AI use this month"
          message="Each AI request lands here with what it cost, so the bill never surprises you."
          mood="calm"
        />
      ) : (
        <div className="grid grid-cols-1 items-start gap-7 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8">
          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-2 rounded-3xl bg-card p-6">
              <p className="text-hero">{dollars(report.costMicros)}</p>
              <p className="text-callout text-muted">
                {report.capMicros === null
                  ? `at OpenAI's list prices · ${plural(report.calls, "request")}`
                  : `of the ${dollars(report.capMicros)} monthly limit · ${plural(report.calls, "request")}`}
              </p>
              {report.capMicros === null ? null : (
                <ProgressBar
                  value={report.costMicros / report.capMicros}
                  tone={report.costMicros >= report.capMicros ? "coral" : "ink"}
                  label="Share of the monthly limit used"
                />
              )}
            </div>
            <Section title="Each day, in cents">
              <div className="rounded-2xl bg-card p-5">
                <ColumnChart
                  label="AI cost each day, in cents"
                  formatValue={cents}
                  formatAxis={(micros) => cents(micros).replace("¢", "")}
                  categories={days.map((d, i) => ({
                    key: d.date,
                    label: formatLocalDate(d.date),
                    tick: (i + 1) % 5 === 1 ? String(i + 1) : undefined,
                  }))}
                  series={[
                    {
                      key: "cost",
                      name: "Cost",
                      tone: "neutral",
                      values: days.map((d) => d.costMicros),
                    },
                  ]}
                />
              </div>
            </Section>
          </div>
          <div className="flex flex-col gap-7">
            <Section title="By feature">
              {report.byFeature.length === 0 ? (
                <p className="px-1 text-callout text-muted">You didn't use AI this month.</p>
              ) : (
                <Group>
                  {report.byFeature.map((row) => (
                    <Row
                      key={row.feature}
                      title={FEATURES[row.feature] ?? row.feature}
                      subtitle={`${plural(row.calls, "request")} · ${thousands(row.inputTokens)} in, ${thousands(row.outputTokens)} out tokens`}
                      trailing={<Value>{dollars(row.costMicros)}</Value>}
                    />
                  ))}
                </Group>
              )}
            </Section>
          </div>
        </div>
      )}
    </div>
  );
}
