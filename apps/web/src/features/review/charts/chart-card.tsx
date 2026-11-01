import type { ReactNode } from "react";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Every report's surface: one card with the chart's title, a one-line takeaway under
 * it ("Food was 38% of spending"), an optional legend on the right, then the chart.
 * - state "ready": the chart.
 * - state "loading": a placeholder the chart's height.
 * - state "failed": Retry in place of the chart.
 */
export function ChartCard({
  id,
  title,
  takeaway,
  legend,
  state = "ready",
  onRetry,
  height = "h-56",
  children,
}: {
  /** Names the card by its title for screen readers. */
  id: string;
  title: string;
  takeaway?: ReactNode;
  legend?: ReactNode;
  state?: "ready" | "loading" | "failed";
  onRetry?: () => void;
  /** The placeholder's height while loading, as a class ("h-56"). */
  height?: string;
  children?: ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      aria-labelledby={headingId}
      className="flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-5"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id={headingId} className="text-heading">
            {title}
          </h2>
          {state === "ready" && takeaway ? (
            <p className="text-callout text-muted">{takeaway}</p>
          ) : state === "loading" ? (
            <Skeleton className="mt-1.5 h-4 w-56" />
          ) : null}
        </div>
        {state === "ready" && legend ? <div className="flex gap-4 pt-1">{legend}</div> : null}
      </header>
      {state === "loading" ? (
        <div role="status" aria-label="Loading">
          <Skeleton className={`${height} rounded-xl`} />
        </div>
      ) : state === "failed" ? (
        <ErrorState onRetry={onRetry ?? (() => {})} />
      ) : (
        children
      )}
    </section>
  );
}

/** Nothing to chart yet: a quiet line in the card, not a full empty screen. */
export function ChartEmpty({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-8 text-center">
      <p className="text-body font-bold">{title}</p>
      <p className="max-w-sm text-callout text-muted">{message}</p>
    </div>
  );
}
