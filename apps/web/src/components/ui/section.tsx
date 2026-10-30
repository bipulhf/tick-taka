import type { ReactNode } from "react";
import { cx } from "./cx";

/** A titled block of a view. The title is a heading; `action` sits on the right. */
export function Section({
  title,
  caption,
  action,
  children,
  className,
  id,
}: {
  title?: string;
  caption?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section aria-labelledby={headingId} className={cx("flex flex-col gap-3", className)}>
      {title || action ? (
        <div className="flex min-h-8 items-end justify-between gap-3 px-1">
          <div>
            {title ? (
              <h2 id={headingId} className="text-heading">
                {title}
              </h2>
            ) : null}
            {caption ? <p className="text-callout text-muted">{caption}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** A text action beside a section title ("Change", "Full day"). */
export function SectionAction({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-1.5 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
    >
      {children}
    </button>
  );
}
