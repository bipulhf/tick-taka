import { Amount } from "@/components/ui/amount";
import { formatAmount, formatLocalDate, formatMonth } from "@/lib/format";
import { usePrivacy } from "@/lib/prefs";
import { BarList, LegendKey } from "./charts/bar-list";
import { ChartCard, ChartEmpty } from "./charts/chart-card";
import { ColumnChart } from "./charts/column-chart";
import { LineChart } from "./charts/line-chart";
import { compactNumber } from "./charts/scale";
import { dayTick, weekTick } from "./insights-data";
import { useMonthlySeries, useNetWorth } from "./queries";

/** Money ticks on an axis are in taka, compact: 126010.00 → "126k". */
export const moneyAxis = (minor: number) => compactNumber(minor / 100);
const money = (minor: number) => formatAmount(minor);

const HIDDEN = <p className="text-callout text-muted">Hidden in privacy mode.</p>;

type CardState = "ready" | "loading" | "failed";

const NO_SPENDING = (
  <ChartEmpty
    title="No spending in this range"
    message="Spending you log in this period shows up here."
  />
);

export function CategorySpending({
  ranked,
  name,
  state,
  onRetry,
}: {
  ranked: [string | null, number][];
  name: (id: string | null) => string;
  state: CardState;
  onRetry: () => void;
}) {
  const total = ranked.reduce((sum, [, amount]) => sum + amount, 0);
  const top = ranked[0];
  const share = top && total ? Math.round((top[1] / total) * 100) : 0;
  return (
    <ChartCard
      id="report-categories"
      title="Spending by category"
      state={state}
      onRetry={onRetry}
      takeaway={
        top
          ? ranked.length === 1
            ? `All of it went to ${name(top[0])}.`
            : `${name(top[0])} was ${share}% of spending.`
          : undefined
      }
    >
      {ranked.length === 0 ? (
        NO_SPENDING
      ) : (
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
      )}
    </ChartCard>
  );
}

/**
 * Spending over the period, a column a day (a week for a year, so it stays
 * readable), with the average and the biggest one as the takeaway.
 */
export function SpendingOverTime({
  points,
  unit,
  state,
  onRetry,
}: {
  points: { date: string; spentMinor: number }[];
  unit: "day" | "week";
  state: CardState;
  onRetry: () => void;
}) {
  const hidden = usePrivacy();
  const total = points.reduce((sum, d) => sum + d.spentMinor, 0);
  const busiest = points.reduce<(typeof points)[number] | null>(
    (top, d) => (d.spentMinor > (top?.spentMinor ?? 0) ? d : top),
    null,
  );
  const average = Math.round(total / Math.max(1, points.length) / 100) * 100;
  const label = unit === "day" ? "Spending by day" : "Spending by week";
  return (
    <ChartCard
      id="report-over-time"
      title={label}
      state={state}
      onRetry={onRetry}
      takeaway={
        busiest ? (
          <>
            About <Amount minor={average} animate={false} /> a {unit}; the most{" "}
            {unit === "day" ? "on" : "in the week of"} {formatLocalDate(busiest.date)} (
            <Amount minor={busiest.spentMinor} animate={false} />
            ).
          </>
        ) : undefined
      }
    >
      {!busiest ? (
        NO_SPENDING
      ) : hidden ? (
        HIDDEN
      ) : (
        <ColumnChart
          label={label}
          formatValue={money}
          formatAxis={moneyAxis}
          categories={points.map((d, i) => ({
            key: d.date,
            label: unit === "day" ? formatLocalDate(d.date) : `Week of ${formatLocalDate(d.date)}`,
            tick:
              unit === "day"
                ? dayTick(d.date, i, points.length)
                : weekTick(d.date, (month) => formatMonth(month).slice(0, 3)),
          }))}
          series={[
            {
              key: "spent",
              name: "Spending",
              tone: "coral",
              values: points.map((d) => d.spentMinor),
            },
          ]}
        />
      )}
    </ChartCard>
  );
}

export function MonthlyFlow({ months }: { months: number }) {
  const hidden = usePrivacy();
  const series = useMonthlySeries(months);
  const rows = series.data ?? [];
  const net = rows.reduce((sum, m) => sum + m.incomeMinor - m.spentMinor, 0);
  return (
    <ChartCard
      id="report-monthly"
      title="Income vs spending by month"
      state={series.data ? "ready" : series.isError ? "failed" : "loading"}
      onRetry={() => void series.refetch()}
      height="h-64"
      legend={
        <>
          <LegendKey tone="mint" label="Income" />
          <LegendKey tone="coral" label="Spending" />
        </>
      }
      takeaway={
        <>
          Net over {months} months: <Amount minor={net} signed animate={false} />
        </>
      }
    >
      {hidden ? (
        HIDDEN
      ) : (
        <ColumnChart
          label="Income vs spending by month"
          formatValue={money}
          formatAxis={moneyAxis}
          categories={rows.map((m) => ({
            key: m.month,
            label: formatMonth(m.month),
            tick: formatMonth(m.month).slice(0, 3),
          }))}
          series={[
            { key: "in", name: "Income", tone: "mint", values: rows.map((m) => m.incomeMinor) },
            { key: "out", name: "Spending", tone: "coral", values: rows.map((m) => m.spentMinor) },
          ]}
        />
      )}
      {/* Months with money in or out, so a quiet half year isn't a column of zeros. */}
      <ul className="flex flex-col gap-1">
        {rows
          .filter((m) => m.incomeMinor || m.spentMinor)
          .map((m) => (
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
  );
}

export function NetWorth({ months }: { months: number }) {
  const hidden = usePrivacy();
  const worth = useNetWorth(months);
  const points = worth.data?.series ?? [];
  const first = points[0];
  const last = points.at(-1);
  return (
    <ChartCard
      id="report-net-worth"
      title="Net worth"
      state={worth.data ? "ready" : worth.isError ? "failed" : "loading"}
      onRetry={() => void worth.refetch()}
      height="h-64"
      takeaway={
        first && last && points.length > 1 ? (
          <>
            <Amount minor={last.netWorthMinor - first.netWorthMinor} signed animate={false} /> since{" "}
            {formatMonth(first.month)}
          </>
        ) : undefined
      }
    >
      <Amount minor={last?.netWorthMinor ?? 0} className="text-title" animate={false} />
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
      {worth.data?.excludedAccounts.length ? (
        <p className="text-caption text-muted">
          Not counted (other currency): {worth.data.excludedAccounts.map((a) => a.name).join(", ")}
        </p>
      ) : null}
    </ChartCard>
  );
}
