import { Amount } from "@/components/ui/amount";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Group, Row } from "@/components/ui/group";
import { Section } from "@/components/ui/section";
import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";
import { formatAmount, formatLocalDate, formatMinutes, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { BarList, LegendKey } from "./charts/bar-list";
import { ColumnChart } from "./charts/column-chart";
import { LineChart } from "./charts/line-chart";
import { compactNumber } from "./charts/scale";
import { dayTick } from "./insights-data";
import { useMonthlySeries, useNetWorth } from "./queries";

/** Money ticks on an axis are in taka, compact: 126010.00 → "126k". */
export const moneyAxis = (minor: number) => compactNumber(minor / 100);
const money = (minor: number) => formatAmount(minor);

/** A chart's surface: one rounded card, the title outside it like every section. */
export function ChartCard({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4 rounded-2xl bg-card p-5">{children}</div>;
}

const HIDDEN = <p className="text-callout text-muted">Hidden in privacy mode.</p>;

export function CategorySpending({
  ranked,
  name,
}: {
  ranked: [string | null, number][];
  name: (id: string | null) => string;
}) {
  return (
    <ChartCard>
      <BarList
        label="Spending by category"
        tone="coral"
        items={ranked.map(([id, amount]) => ({
          key: id ?? "none",
          label: name(id),
          value: amount,
          valueText: <Amount minor={amount} animate={false} />,
        }))}
      />
    </ChartCard>
  );
}

export function DailySpending({ days }: { days: { date: string; spentMinor: number }[] }) {
  const hidden = usePrivacy();
  const total = days.reduce((sum, d) => sum + d.spentMinor, 0);
  const busiest = days.reduce<(typeof days)[number] | null>(
    (top, d) => (d.spentMinor > (top?.spentMinor ?? 0) ? d : top),
    null,
  );
  return (
    <ChartCard>
      {hidden ? (
        HIDDEN
      ) : (
        <ColumnChart
          label="Spending by day"
          formatValue={money}
          formatAxis={moneyAxis}
          categories={days.map((d, i) => ({
            key: d.date,
            label: formatLocalDate(d.date),
            tick: dayTick(d.date, i, days.length),
          }))}
          series={[
            {
              key: "spent",
              name: "Spending",
              tone: "coral",
              values: days.map((d) => d.spentMinor),
            },
          ]}
        />
      )}
      {busiest ? (
        <p className="text-callout text-muted">
          About{" "}
          <Amount
            minor={Math.round(total / Math.max(1, days.length) / 100) * 100}
            animate={false}
          />{" "}
          a day; the most on {formatLocalDate(busiest.date)} (
          <Amount minor={busiest.spentMinor} animate={false} />
          ).
        </p>
      ) : null}
    </ChartCard>
  );
}

export function MonthlyFlow() {
  const hidden = usePrivacy();
  const series = useMonthlySeries(6);
  return (
    <Section title="Income vs spending by month">
      {!series.data ? (
        series.isError ? (
          <ErrorState onRetry={() => void series.refetch()} />
        ) : (
          <Skeleton className="h-64 rounded-2xl" />
        )
      ) : (
        <ChartCard>
          <div className="flex gap-4">
            <LegendKey tone="mint" label="Income" />
            <LegendKey tone="coral" label="Spending" />
          </div>
          {hidden ? (
            HIDDEN
          ) : (
            <ColumnChart
              label="Income vs spending by month"
              formatValue={money}
              formatAxis={moneyAxis}
              categories={series.data.map((m) => ({
                key: m.month,
                label: formatMonth(m.month),
                tick: formatMonth(m.month).slice(0, 3),
              }))}
              series={[
                {
                  key: "in",
                  name: "Income",
                  tone: "mint",
                  values: series.data.map((m) => m.incomeMinor),
                },
                {
                  key: "out",
                  name: "Spending",
                  tone: "coral",
                  values: series.data.map((m) => m.spentMinor),
                },
              ]}
            />
          )}
          <ul className="flex flex-col gap-1">
            {series.data.map((m) => (
              <li key={m.month} className="flex justify-between gap-3 text-caption">
                <span className="text-muted">{formatMonth(m.month)}</span>
                <span className="tabular">
                  <Amount minor={m.incomeMinor} animate={false} /> in ·{" "}
                  <Amount minor={m.spentMinor} animate={false} /> out
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      )}
    </Section>
  );
}

export function NetWorth() {
  const hidden = usePrivacy();
  const worth = useNetWorth(6);
  const points = worth.data?.series ?? [];
  return (
    <Section title="Net worth">
      {!worth.data ? (
        worth.isError ? (
          <ErrorState onRetry={() => void worth.refetch()} />
        ) : (
          <Skeleton className="h-64 rounded-2xl" />
        )
      ) : (
        <ChartCard>
          <Amount
            minor={points.at(-1)?.netWorthMinor ?? 0}
            className="text-title"
            animate={false}
          />
          {points.length && !hidden ? (
            <LineChart
              label="Net worth at the end of each month"
              name="Net worth"
              formatValue={money}
              formatAxis={moneyAxis}
              points={points.map((p) => ({
                key: p.month,
                label: formatMonth(p.month),
                tick: formatMonth(p.month).slice(0, 3),
                value: p.netWorthMinor,
              }))}
            />
          ) : hidden ? (
            HIDDEN
          ) : null}
          {worth.data.excludedAccounts.length ? (
            <p className="text-caption text-muted">
              Not counted (other currency):{" "}
              {worth.data.excludedAccounts.map((a) => a.name).join(", ")}
            </p>
          ) : null}
        </ChartCard>
      )}
    </Section>
  );
}

export interface AreaStat {
  area: { id: string; name: string; emoji: string | null };
  spent: number;
  minutes: number;
  rate: number | null;
}

export function HoursByArea({ rows }: { rows: AreaStat[] }) {
  const tracked = rows.filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  if (tracked.length === 0)
    return (
      <EmptyState
        title="No hours tracked"
        message="Track time with an area and it shows up here."
        mood="relaxed"
      />
    );
  return (
    <ChartCard>
      <BarList
        label="Hours by area"
        tone="sky"
        items={tracked.map((r) => ({
          key: r.area.id,
          label: `${r.area.emoji ?? ""} ${r.area.name}`.trim(),
          value: r.minutes,
          valueText: formatMinutes(r.minutes),
        }))}
      />
    </ChartCard>
  );
}

export function AreaRows({ rows, overallRate }: { rows: AreaStat[]; overallRate: number | null }) {
  return (
    <div className="flex flex-col gap-3">
      <Group>
        {rows.map(({ area, spent, minutes, rate }) => (
          <Row
            key={area.id}
            leading={<span aria-hidden>{area.emoji}</span>}
            title={area.name}
            subtitle={
              <>
                {formatMinutes(minutes)} · spent <Amount minor={spent} animate={false} />
              </>
            }
            trailing={
              rate ? (
                <span className="text-callout font-semibold tabular">
                  <Amount minor={Math.round(rate / 100) * 100} animate={false} />
                  /h
                </span>
              ) : undefined
            }
          />
        ))}
      </Group>
      {overallRate ? (
        <p className="px-1 text-caption text-muted">
          Across all your work, about{" "}
          <Amount minor={Math.round(overallRate / 100) * 100} animate={false} /> an hour over the
          last 90 days.
        </p>
      ) : null}
    </div>
  );
}

export function SectionSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading">
      <SkeletonRows rows={rows} />
    </div>
  );
}
