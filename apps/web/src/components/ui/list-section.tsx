import type { ReactNode } from "react";
import { cx } from "./cx";

/** Where the total lines up: over the rows' amounts. */
const ALIGN = {
  /** Rows end with a "more" menu (RowMenu) after the amount: leave its room. */
  menu: "pr-14",
  /** Rows end with the amount itself. */
  edge: "pr-4",
} as const;

/**
 * A grouped list's header: the title on the left and the group's total on the right,
 * over the rows' amounts ("Today · −৳1,270"), then the list itself (usually a Group).
 * - variant "label": a quiet 13 px label, for runs in a long list (the days of Transactions).
 * - variant "heading": a section heading, for a page's groups (account types, budget buckets).
 */
export function ListSection({
  title,
  total,
  caption,
  variant = "label",
  align = "menu",
  id,
  children,
  className,
}: {
  title: ReactNode;
  /** The group's total, usually an Amount (it follows Hide amounts and Bangla digits). */
  total?: ReactNode;
  /** One short line under the title ("Food, rides, fun. Drives safe to spend."). */
  caption?: ReactNode;
  variant?: "label" | "heading";
  align?: keyof typeof ALIGN;
  /** Names the heading, so the section is announced by it. */
  id: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id}-title`;
  const heading = variant === "heading";
  return (
    <section
      aria-labelledby={headingId}
      className={cx("flex flex-col", heading ? "gap-3" : "gap-2", className)}
    >
      <div className={cx("flex items-end justify-between gap-3 pl-1", ALIGN[align])}>
        <div className="min-w-0">
          <h2 id={headingId} className={heading ? "text-heading" : "text-caption text-muted"}>
            {title}
          </h2>
          {caption ? <p className="text-caption font-normal text-muted">{caption}</p> : null}
        </div>
        {total !== undefined && total !== null ? (
          <div
            className={cx(
              "shrink-0 tabular",
              heading ? "text-callout font-bold" : "text-caption font-bold text-muted",
            )}
          >
            {total}
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
