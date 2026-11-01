import { Amount } from "@/components/ui/amount";
import { formatMinutes } from "@/lib/format";
import { BarList } from "./charts/bar-list";
import { ChartCard, ChartEmpty } from "./charts/chart-card";

export interface AreaStat {
  area: { id: string; name: string; emoji: string | null };
  spent: number;
  minutes: number;
  rate: number | null;
}

type CardState = "ready" | "loading" | "failed";

const areaName = (area: AreaStat["area"]) => `${area.emoji ?? ""} ${area.name}`.trim();

/** Tracked time by area, largest first, and where most of it went. */
export function HoursByArea({
  rows,
  state,
  onRetry,
}: {
  rows: AreaStat[];
  state: CardState;
  onRetry: () => void;
}) {
  const tracked = rows.filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const total = tracked.reduce((sum, r) => sum + r.minutes, 0);
  const top = tracked[0];
  return (
    <ChartCard
      id="report-hours"
      title="Hours by area"
      state={state}
      onRetry={onRetry}
      height="h-40"
      takeaway={
        top
          ? `Most went to ${areaName(top.area)}: ${formatMinutes(top.minutes)} of ${formatMinutes(total)}.`
          : undefined
      }
    >
      {tracked.length === 0 ? (
        <ChartEmpty
          title="No hours tracked"
          message="Track time with an area and it shows up here."
        />
      ) : (
        <BarList
          label="Hours by area"
          tone="sky"
          items={tracked.map((r) => ({
            key: r.area.id,
            label: areaName(r.area),
            value: r.minutes,
            valueText: formatMinutes(r.minutes),
          }))}
        />
      )}
    </ChartCard>
  );
}

/** Each area's hours, spending and what an hour of it earned, with the overall rate. */
export function AreaRates({
  rows,
  overallRate,
  state,
  onRetry,
}: {
  rows: AreaStat[];
  overallRate: number | null;
  state: CardState;
  onRetry: () => void;
}) {
  return (
    <ChartCard
      id="report-areas"
      title="By area"
      state={state}
      onRetry={onRetry}
      height="h-40"
      takeaway={
        overallRate ? (
          <>
            Across all your work, about{" "}
            <Amount minor={Math.round(overallRate / 100) * 100} animate={false} /> an hour over the
            last 90 days.
          </>
        ) : (
          "Time, spending and an hour's worth for each area."
        )
      }
    >
      {rows.length === 0 ? (
        <ChartEmpty
          title="Nothing by area yet"
          message="Tag time and spending with an area to compare them here."
        />
      ) : (
        <ul aria-label="By area" className="-my-1 flex flex-col divide-y divide-line">
          {rows.map(({ area, spent, minutes, rate }) => (
            <li key={area.id} className="flex items-center gap-3 py-2.5">
              <span aria-hidden className="w-6 shrink-0 text-center">
                {area.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body">{area.name}</span>
                <span className="block truncate text-caption text-muted">
                  {formatMinutes(minutes)} · spent <Amount minor={spent} animate={false} />
                </span>
              </span>
              {rate ? (
                <span className="shrink-0 text-callout font-semibold tabular">
                  <Amount minor={Math.round(rate / 100) * 100} animate={false} />
                  /h
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ChartCard>
  );
}
