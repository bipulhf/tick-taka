import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * A section folded away at the end of a page, opened by its title ("Archived (2)",
 * "Settled (3)", "Done (1)"): what is finished stays at hand without taking room.
 * Rows inside a closed fold are skipped by J / K.
 */
export function FoldedSection({
  title,
  count,
  caption,
  children,
  className,
}: {
  title: string;
  /** How many items are inside, shown beside the title. */
  count: number;
  /** One short line under the title, shown when open. */
  caption?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details className={cx("group/folded flex flex-col", className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-1 py-0.5 text-heading hover:bg-line/40 [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden
          className="size-4 text-muted transition-transform duration-150 group-open/folded:rotate-90"
        />
        {title}
        <span className="text-callout font-normal text-muted">({count})</span>
      </summary>
      {caption ? <p className="mt-1 px-1 text-caption font-normal text-muted">{caption}</p> : null}
      <div className="mt-3">{children}</div>
    </details>
  );
}
