import { Children, type ReactNode } from "react";
import { Amount } from "./amount";
import { cx } from "./cx";
import { Skeleton } from "./skeleton";

/**
 * What a tile's figure means, said with a small mark beside the label:
 * - neutral: no mark, ink figure (a count, a total that is neither in nor out).
 * - in: money in, mint mark and mint figure.
 * - out: money out, coral mark and coral figure (soft, never alarm red).
 * - flow: a net figure, mint when above zero and coral below, with its sign.
 * - time: days and dates, a sky mark and an ink figure.
 */
export type StatTone = "neutral" | "in" | "out" | "flow" | "time";

const MARKS: Record<StatTone, string | null> = {
  neutral: null,
  in: "bg-mint",
  out: "bg-coral",
  flow: "bg-line-strong",
  time: "bg-sky",
};

export interface StatTileProps {
  /** What the figure is, in a few words ("Spent", "Left to spend"). */
  label: string;
  /** A money figure in minor units, drawn by Amount: it follows Hide amounts and Bangla digits. */
  minor?: number;
  currency?: string;
  /** Prints a leading + above zero (a minus always shows). On by default for `tone="flow"`. */
  signed?: boolean;
  /** A figure that isn't money ("12", "29 days"), used when `minor` is left out. */
  value?: ReactNode;
  /** One short line under the figure: "of ৳14,500", "29 days left". */
  caption?: ReactNode;
  tone?: StatTone;
  /** "lead" is a strip's headline (net worth): hero size, and the first, wider column. */
  size?: "md" | "lead";
  /** Still loading: a placeholder the size of the figure. */
  loading?: boolean;
}

/** One figure with its label, as text (screen readers read label, figure, caption in order). */
export function StatTile({
  label,
  minor,
  currency,
  signed,
  value,
  caption,
  tone = "neutral",
  size = "md",
  loading,
}: StatTileProps) {
  const mark = MARKS[tone];
  const lead = size === "lead";
  return (
    <div className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3.5 sm:px-5 sm:py-4">
      <dt className="flex items-center gap-1.5 text-caption text-muted">
        {mark ? <span aria-hidden className={cx("size-2 shrink-0 rounded-full", mark)} /> : null}
        <span className="truncate">{label}</span>
      </dt>
      <dd className={cx("min-w-0 truncate", lead ? "text-hero" : "text-title")}>
        {loading ? (
          <Skeleton className={cx("my-1", lead ? "h-10 w-48" : "h-6 w-24")} />
        ) : minor !== undefined ? (
          <Amount
            minor={minor}
            currency={currency}
            signed={signed ?? tone === "flow"}
            tone={tone === "in" || tone === "out" || tone === "flow" ? tone : undefined}
          />
        ) : (
          <span className="tabular">{value}</span>
        )}
      </dd>
      {caption ? (
        <dd className="min-w-0 truncate text-caption font-normal text-muted">{caption}</dd>
      ) : null}
    </div>
  );
}

const EVEN: Record<number, string> = {
  2: "grid-cols-2",
  3: "grid-cols-2 sm:grid-cols-3 max-sm:[&>*:first-child]:col-span-2",
  4: "grid-cols-2 lg:grid-cols-4",
};

const LEAD: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]",
  3: "grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] max-lg:[&>*:first-child]:col-span-2",
  4: "grid-cols-2 sm:grid-cols-3 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] max-xl:[&>*:first-child]:col-span-full max-sm:[&>*:last-child]:col-span-2",
};

/**
 * The summary strip under a page title: 2 to 4 StatTiles on one surface with hairlines
 * between them (one surface, not a grid of cards). Two columns on a phone; an odd tile
 * out takes the full row there, so no cell is left empty.
 * - layout "even": equal columns.
 * - layout "lead": the first tile (size="lead") gets twice the room, for a headline figure.
 */
export function SummaryStrip({
  label,
  layout = "even",
  children,
  className,
}: {
  /** Names the strip for screen readers ("This month"). */
  label: string;
  layout?: "even" | "lead";
  children: ReactNode;
  className?: string;
}) {
  const count = Math.min(4, Math.max(2, Children.count(children)));
  return (
    <dl
      aria-label={label}
      className={cx(
        "grid gap-px overflow-hidden rounded-2xl bg-line",
        (layout === "lead" ? LEAD : EVEN)[count],
        className,
      )}
    >
      {children}
    </dl>
  );
}
