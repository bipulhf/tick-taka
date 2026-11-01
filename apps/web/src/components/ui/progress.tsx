import { cx } from "./cx";

const FILLS = {
  sky: "bg-sky",
  mint: "bg-mint",
  coral: "bg-coral",
  grape: "bg-grape",
  mango: "bg-mango",
  /** Neutral progress, for anything that isn't time, money or a habit. */
  ink: "bg-ink",
} as const;

export type ProgressTone = keyof typeof FILLS;

export function ProgressBar({
  value,
  tone = "mint",
  label,
  className,
  marker,
}: {
  value: number;
  tone?: ProgressTone;
  /** What the bar measures, for screen readers. */
  label?: string;
  className?: string;
  /**
   * A thin pace mark across the bar, 0 to 1 (where today falls in the month). Ink with
   * a ring in the card colour, so it reads on the track and on every fill.
   */
  marker?: number;
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  if (marker !== undefined)
    return (
      <div className={cx("relative", className)}>
        <ProgressBar value={value} tone={tone} label={label} />
        <span
          aria-hidden
          className="absolute -top-0.5 -bottom-0.5 w-0.5 -translate-x-1/2 rounded-full bg-ink ring-2 ring-card"
          style={{ left: `${Math.max(0, Math.min(1, marker)) * 100}%` }}
        />
      </div>
    );
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className={cx("h-2 overflow-hidden rounded-full bg-line", className)}
    >
      <div
        className={cx(
          "h-full rounded-full transition-[width] duration-500 ease-out-quart",
          FILLS[tone],
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

const STROKES = {
  sky: "stroke-sky-text",
  mint: "stroke-mint-text",
  grape: "stroke-grape-text",
  coral: "stroke-coral-text",
  ink: "stroke-ink",
} as const;

/**
 * A progress ring (habits, focus). The arc is the only cue to the value, so it uses
 * the `-text` token, which keeps 3:1 on every surface.
 */
export function Ring({
  value,
  size = 40,
  stroke = 4,
  tone = "grape",
  children,
  label,
}: {
  value: number;
  size?: number;
  stroke?: number;
  tone?: keyof typeof STROKES;
  children?: React.ReactNode;
  label?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <span
      role="img"
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={cx(
            STROKES[tone],
            "transition-[stroke-dashoffset] duration-500 ease-out-quart",
          )}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </span>
  );
}
