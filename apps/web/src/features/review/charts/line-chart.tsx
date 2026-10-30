import { useState } from "react";
import { ChartReadout, ChartTable } from "./chart-parts";
import { compactNumber, fraction, niceDomain } from "./scale";
import { stepIndex, useWidth } from "./use-width";

export interface LinePoint {
  key: string;
  /** Full name, for the readout and the table ("Oct 2026"). */
  label: string;
  /** What the x axis prints under the point. */
  tick: string;
  value: number;
}

const AXIS_W = 44;
const TICK_H = 22;
const TOP = 10;
const END_LABEL_W = 72;
/** Keeps the first point clear of the lowest tick label. */
const PAD = 16;

/**
 * One neutral 2 px line over time with a faint wash under it, the latest value
 * labelled at its end. A crosshair follows the pointer or the arrow keys; every
 * value is also in a table for screen readers.
 */
export function LineChart({
  label,
  name,
  points,
  formatValue,
  formatAxis = compactNumber,
  height = 160,
}: {
  label: string;
  /** The series, for the table header ("Net worth"). */
  name: string;
  points: LinePoint[];
  formatValue: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = points.length;
  const values = points.map((p) => p.value);
  // A line needs no zero baseline: the scale hugs the values so the change shows.
  const domain = n ? niceDomain(Math.min(...values), Math.max(...values), 3) : niceDomain(0, 0);
  const plotW = Math.max(1, width - AXIS_W - PAD - END_LABEL_W);
  const x = (i: number) => AXIS_W + PAD + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const y = (value: number) => TOP + height * (1 - fraction(value, domain.min, domain.max));
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join("");
  const base = y(domain.min);
  const area = n > 1 ? `${line}L${x(n - 1)},${base}L${x(0)},${base}Z` : "";
  const last = points[n - 1];
  const nearest = (clientX: number, left: number) => {
    if (n === 0) return null;
    const at = n <= 1 ? 0 : Math.round(((clientX - left - AXIS_W - PAD) / plotW) * (n - 1));
    return Math.max(0, Math.min(n - 1, at));
  };

  return (
    <figure
      ref={ref}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys read the points one by one
      tabIndex={0}
      aria-label={`${label}. Use the arrow keys to read each value.`}
      onFocus={() => setActive((a) => a ?? n - 1)}
      onBlur={() => setActive(null)}
      onKeyDown={(event) => {
        const next = stepIndex(event.key, active, n);
        if (next === null) return;
        event.preventDefault();
        setActive(next);
      }}
      onPointerMove={(event) =>
        setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect().left))
      }
      onPointerLeave={() => setActive(null)}
      className="relative min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-text focus-visible:ring-offset-4 focus-visible:ring-offset-card"
    >
      <svg width={width} height={TOP + height + TICK_H} aria-hidden className="block max-w-full">
        {domain.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS_W}
              x2={AXIS_W + PAD + plotW}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={AXIS_W - 8}
              y={y(tick)}
              dy="0.32em"
              textAnchor="end"
              className="fill-muted text-[11px] font-semibold tabular"
            >
              {formatAxis(tick)}
            </text>
          </g>
        ))}
        {area ? <path d={area} className="fill-ink/[0.06]" /> : null}
        <path
          d={line}
          fill="none"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-ink"
        />
        {active !== null ? (
          <line
            x1={x(active)}
            x2={x(active)}
            y1={TOP}
            y2={TOP + height}
            strokeWidth={1}
            className="stroke-line-strong"
          />
        ) : null}
        {points.map((p, i) =>
          i === active || i === n - 1 ? (
            <circle
              key={p.key}
              cx={x(i)}
              cy={y(p.value)}
              r={4.5}
              strokeWidth={2}
              className="fill-ink stroke-card"
            />
          ) : null,
        )}
        {last ? (
          <text
            x={x(n - 1) + 10}
            y={y(last.value)}
            dy="0.32em"
            className="fill-ink text-[12px] font-bold tabular"
          >
            {formatAxis(last.value)}
          </text>
        ) : null}
        {points.map((p, i) => (
          <text
            key={p.key}
            x={x(i)}
            y={TOP + height + 16}
            textAnchor="middle"
            className="fill-muted text-[11px] font-semibold"
          >
            {p.tick}
          </text>
        ))}
      </svg>
      {active !== null && points[active] ? (
        <ChartReadout
          title={points[active].label}
          x={x(active)}
          width={width}
          rows={[{ key: name, name, tone: "neutral", value: formatValue(points[active].value) }]}
        />
      ) : null}
      <ChartTable
        caption={label}
        categories={points.map((p) => p.label)}
        series={[{ key: name, name, values: points.map((p) => formatValue(p.value)) }]}
      />
    </figure>
  );
}
