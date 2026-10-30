import { cx } from "@/components/ui/cx";
import { type ChartTone, FILLS } from "./bar-list";

export interface ReadoutRow {
  key: string;
  name: string;
  tone: ChartTone;
  value: string;
}

/**
 * The hover and focus readout over a chart: values lead in bold, each keyed by a
 * short stroke of its series colour, the category under them.
 */
export function ChartReadout({
  title,
  rows,
  x,
  width,
}: {
  title: string;
  rows: ReadoutRow[];
  /** Centre of the mark, in px from the chart's left edge. */
  x: number;
  width: number;
}) {
  const box = 168;
  const left = Math.max(0, Math.min(width - box, x - box / 2));
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute top-0 z-10 flex flex-col gap-0.5 rounded-xl bg-ink px-3 py-2 text-background shadow-lg"
      style={{ left, width: box }}
    >
      {rows.map((row) => (
        <span key={row.key} className="flex items-center gap-2">
          <span aria-hidden className={cx("h-0.5 w-3 shrink-0 rounded-full", FILLS[row.tone])} />
          <span className="text-callout font-extrabold tabular">{row.value}</span>
          {rows.length > 1 ? (
            <span className="truncate text-caption text-background/70">{row.name}</span>
          ) : null}
        </span>
      ))}
      <span className="text-caption text-background/70">{title}</span>
    </div>
  );
}

/** Every value of a chart as a table, for screen readers (the chart itself is a picture). */
export function ChartTable({
  caption,
  categories,
  series,
}: {
  caption: string;
  categories: string[];
  series: { key: string; name: string; values: string[] }[];
}) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">When</th>
          {series.map((s) => (
            <th key={s.key} scope="col">
              {s.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((category, index) => (
          <tr key={category}>
            <th scope="row">{category}</th>
            {series.map((s) => (
              <td key={s.key}>{s.values[index]}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Stroke classes for SVG marks, the same tokens as the fills. */
export const STROKES: Record<ChartTone, string> = {
  mint: "stroke-mint",
  coral: "stroke-coral",
  sky: "stroke-sky",
  neutral: "stroke-line-strong",
};

export const SVG_FILLS: Record<ChartTone, string> = {
  mint: "fill-mint",
  coral: "fill-coral",
  sky: "fill-sky",
  neutral: "fill-line-strong",
};
