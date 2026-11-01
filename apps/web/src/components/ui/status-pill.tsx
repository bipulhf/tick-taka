import type { ReactNode } from "react";
import { cx } from "./cx";

const TONES = {
  /** Nothing to act on yet. */
  neutral: "bg-line/70 text-muted",
  /** Time: due soon, due today. */
  sky: "bg-sky/12 text-sky-text",
  /** Settled and good: paid, on track, done. */
  mint: "bg-mint/12 text-mint-text",
  /** Needs a look, calmly: overdue, behind, over budget. Soft coral, never alarm red. */
  coral: "bg-coral/12 text-coral-text",
} as const;

export type PillTone = keyof typeof TONES;

/** The states a money row can be in, each with its default words and tone. */
const STATUSES = {
  overdue: { label: "Overdue", tone: "coral" },
  due_today: { label: "Due today", tone: "sky" },
  due_soon: { label: "Due soon", tone: "sky" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  paid: { label: "Paid", tone: "mint" },
  on_track: { label: "On track", tone: "mint" },
  behind: { label: "Behind", tone: "coral" },
  over: { label: "Over budget", tone: "coral" },
  done: { label: "Done", tone: "mint" },
} as const satisfies Record<string, { label: string; tone: PillTone }>;

export type PillStatus = keyof typeof STATUSES;

/**
 * A small state label: words and a tone, never colour alone (the text carries the
 * meaning). `status` picks both; `children` replaces the words when the row says more
 * ("Was due Mon 5 Oct", "Over by ৳500"), keeping the tone.
 */
export function StatusPill({
  status,
  children,
  className,
}: {
  status: PillStatus;
  children?: ReactNode;
  className?: string;
}) {
  const { label, tone } = STATUSES[status];
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-caption font-bold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />
      {children ?? label}
    </span>
  );
}
