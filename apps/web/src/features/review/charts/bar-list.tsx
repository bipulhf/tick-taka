import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type ChartTone = "mint" | "coral" | "sky" | "neutral";

/** Bright fills: every bar sits beside its label and value, so colour is never the only cue. */
export const FILLS: Record<ChartTone, string> = {
  mint: "bg-mint",
  coral: "bg-coral",
  sky: "bg-sky",
  neutral: "bg-line-strong",
};

export interface BarItem {
  key: string;
  label: ReactNode;
  value: number;
  /** The value as words beside the bar (an Amount, "3h 20m"). */
  valueText: ReactNode;
  /** Read in place of the visible label and value, e.g. "Food: ৳4,200". */
  ariaLabel?: string;
}

/**
 * A ranked list of horizontal bars: name and value on one line, a thin bar under
 * them measured against the largest. Values are always printed, so it reads the
 * same without the bars.
 */
export function BarList({
  items,
  tone,
  label,
  className,
}: {
  items: BarItem[];
  tone: ChartTone;
  /** Names the list for screen readers ("Spending by category"). */
  label: string;
  className?: string;
}) {
  const top = Math.max(1, ...items.map((item) => item.value));
  return (
    <ul aria-label={label} className={cx("flex flex-col gap-3.5", className)}>
      {items.map((item) => (
        <li key={item.key} aria-label={item.ariaLabel} className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-body">{item.label}</span>
            <span className="shrink-0 text-body font-semibold tabular">{item.valueText}</span>
          </div>
          <div aria-hidden className="h-2 overflow-hidden rounded-full bg-line/70">
            <div
              className={cx(
                "h-full rounded-full transition-[width] duration-500 ease-out-quart",
                FILLS[tone],
              )}
              style={{ width: `${Math.max(item.value > 0 ? 2 : 0, (item.value / top) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A legend key: a small swatch in the series' fill and its name in text colour. */
export function LegendKey({
  tone,
  label,
  line,
}: {
  tone: ChartTone;
  label: string;
  line?: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-caption text-muted">
      <span
        aria-hidden
        className={cx(line ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-sm", FILLS[tone])}
      />
      {label}
    </span>
  );
}
