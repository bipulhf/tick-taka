import { useState } from "react";
import type { ChartTone } from "./bar-list";
import { ChartReadout, ChartTable, SVG_FILLS } from "./chart-parts";
import { compactNumber, fraction, niceDomain } from "./scale";
import { stepIndex, useWidth } from "./use-width";

export interface ColumnSeries {
  key: string;
  name: string;
  tone: ChartTone;
  values: number[];
}

export interface ColumnCategory {
  key: string;
  /** Full name, for the readout and the table ("Tue 6 Oct"). */
  label: string;
  /** What the x axis prints under the column; leave out to keep the axis sparse. */
  tick?: string;
}

const AXIS_W = 44;
const TICK_H = 22;
const TOP = 8;
const MAX_COLUMN = 24;
const GAP = 2;

/** A column whose data end is rounded and whose baseline end is square. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * Columns over time from one baseline, one or two series side by side. Hairline
 * grid, clean ticks on the left, a readout on hover or arrow keys, and a table of
 * every value for screen readers.
 */
export function ColumnChart({
  label,
  categories,
  series,
  formatValue,
  formatAxis = compactNumber,
  height = 168,
}: {
  label: string;
  categories: ColumnCategory[];
  series: ColumnSeries[];
  /** A value as words ("৳1,200", "4.2¢"). */
  formatValue: (value: number) => string;
  /** A tick on the value axis, short ("2k"). */
  formatAxis?: (value: number) => string;
  /** Plot height in px; the x axis band is added under it. */
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = categories.length;
  const max = Math.max(0, ...series.flatMap((s) => s.values));
  const domain = niceDomain(0, max, 3);
  const plotW = Math.max(1, width - AXIS_W);
  const band = plotW / Math.max(1, n);
  const count = Math.max(1, series.length);
  const inner = Math.min(band * 0.72, MAX_COLUMN * count + GAP * (count - 1));
  const columnW = Math.max(1, (inner - GAP * (count - 1)) / count);
  const y = (value: number) => TOP + height * (1 - fraction(value, domain.min, domain.max));
  const centre = (i: number) => AXIS_W + band * i + band / 2;

  return (
    <figure
      ref={ref}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: arrow keys read the columns one by one
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
      onPointerLeave={() => setActive(null)}
      className="relative min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-sky-text focus-visible:ring-offset-4 focus-visible:ring-offset-card"
    >
      <svg width={width} height={TOP + height + TICK_H} aria-hidden className="block max-w-full">
        {domain.ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS_W}
              x2={width}
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
        {categories.map((category, i) => (
          <g key={category.key}>
            {active === i ? (
              <rect
                x={AXIS_W + band * i}
                y={TOP}
                width={band}
                height={height}
                rx={6}
                className="fill-line/50"
              />
            ) : null}
            {series.map((s, j) => {
              const value = s.values[i] ?? 0;
              const top = y(value);
              const h = TOP + height - top;
              if (h <= 0) return null;
              const x = centre(i) - inner / 2 + j * (columnW + GAP);
              return (
                <path
                  key={s.key}
                  d={columnPath(x, top, columnW, h)}
                  className={SVG_FILLS[s.tone]}
                />
              );
            })}
            {category.tick ? (
              <text
                x={centre(i)}
                y={TOP + height + 16}
                textAnchor="middle"
                className="fill-muted text-[11px] font-semibold"
              >
                {category.tick}
              </text>
            ) : null}
            <rect
              x={AXIS_W + band * i}
              y={0}
              width={band}
              height={TOP + height + TICK_H}
              fill="transparent"
              onPointerEnter={() => setActive(i)}
            />
          </g>
        ))}
      </svg>
      {active !== null && categories[active] ? (
        <ChartReadout
          title={categories[active].label}
          x={centre(active)}
          width={width}
          rows={series.map((s) => ({
            key: s.key,
            name: s.name,
            tone: s.tone,
            value: formatValue(s.values[active] ?? 0),
          }))}
        />
      ) : null}
      <ChartTable
        caption={label}
        categories={categories.map((c) => c.label)}
        series={series.map((s) => ({
          key: s.key,
          name: s.name,
          values: s.values.map(formatValue),
        }))}
      />
    </figure>
  );
}
