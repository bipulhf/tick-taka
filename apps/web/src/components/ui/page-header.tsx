import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

/** One big bold title at the top of each view; pushed views get a back link beside it. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Where the back chevron goes, e.g. "/money". */
  back?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        {back ? (
          <Link
            to={back.to}
            className="mb-1 inline-flex items-center gap-0.5 rounded-lg py-0.5 pr-1.5 text-callout font-bold text-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-large-title">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-callout text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
