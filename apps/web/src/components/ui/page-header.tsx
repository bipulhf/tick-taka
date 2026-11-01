import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";

/** A view's one mango action, named for the page ("New bill", "New goal"). */
export interface PrimaryAction {
  label: string;
  onClick: () => void;
  icon?: LucideIcon;
  disabled?: boolean;
}

/** One big bold title at the top of each view; pushed views get a back link beside it. */
export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  primary,
  summary,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Where the back chevron goes, e.g. "/money". */
  back?: { to: string; label: string; search?: Record<string, string> };
  /** Secondary controls and actions (outlined buttons, a month stepper), before `primary`. */
  actions?: ReactNode;
  /** The one primary (mango) action, always last in the row. */
  primary?: PrimaryAction;
  /** A SummaryStrip (or a short note) under the title row. */
  summary?: ReactNode;
}) {
  const row = (
    <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
      <div className="min-w-0 grow">
        {back ? (
          <Link
            to={back.to}
            search={back.search}
            className="mb-1 inline-flex items-center gap-0.5 rounded-lg py-0.5 pr-1.5 text-callout font-bold text-muted hover:text-ink"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="text-large-title">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-callout text-muted">{subtitle}</p> : null}
      </div>
      {actions || primary ? (
        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {primary ? (
            <Button
              variant="primary"
              icon={primary.icon}
              onClick={primary.onClick}
              disabled={primary.disabled}
            >
              {primary.label}
            </Button>
          ) : null}
        </div>
      ) : null}
    </header>
  );
  if (!summary) return row;
  return (
    <div className="flex flex-col gap-5">
      {row}
      {summary}
    </div>
  );
}
