import { formatMinutes } from "@/lib/format";

export interface Bar {
  key: string;
  label: string;
  /** Read by screen readers, e.g. "Monday 26 Oct". */
  name: string;
  value: number;
}

const HEIGHT = 180;
const LABEL = 22;
const VALUE = 20;

/**
 * Seven quiet bars on the tokens, each with its value above it, so the number is
 * never only in a bar's height. Hand-built SVG, as the brief asks.
 */
export function WeekBars({ bars, today }: { bars: Bar[]; today?: string }) {
  const max = Math.max(1, ...bars.map((b) => b.value));
  const plot = HEIGHT - LABEL - VALUE;
  const step = 100 / bars.length;
  return (
    <figure className="relative h-[180px]">
      <svg
        role="img"
        aria-label={bars.map((b) => `${b.name}: ${formatMinutes(b.value)}`).join(", ")}
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <line
          x1={0}
          x2={100}
          y1={HEIGHT - LABEL}
          y2={HEIGHT - LABEL}
          className="stroke-line"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {bars.map((bar, i) => {
          const h = bar.value ? Math.max(3, (bar.value / max) * plot) : 0;
          const x = i * step + step * 0.22;
          const w = step * 0.56;
          return (
            <rect
              key={bar.key}
              x={x}
              y={HEIGHT - LABEL - h}
              width={w}
              height={h}
              rx={1.2}
              className="fill-sky"
            />
          );
        })}
      </svg>
      {/* Labels as HTML, so the text isn't stretched with the chart. */}
      <div aria-hidden className="absolute inset-0 grid grid-cols-7">
        {bars.map((bar) => {
          const h = bar.value ? Math.max(3, (bar.value / max) * plot) : 0;
          return (
            <div key={bar.key} className="relative flex flex-col items-center justify-end">
              <span
                className="absolute text-caption text-muted tabular"
                style={{ bottom: LABEL + h + 2 }}
              >
                {bar.value ? formatMinutes(bar.value) : ""}
              </span>
              <span
                className={`text-caption ${bar.key === today ? "font-extrabold text-ink" : "text-muted"}`}
                style={{ height: LABEL - 4 }}
              >
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>
    </figure>
  );
}
