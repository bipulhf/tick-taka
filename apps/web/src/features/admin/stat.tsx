import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

/** One number with its name, for the dashboard's summary rows. */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "coral";
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl bg-card px-4 py-3.5">
      <span className="text-caption text-muted">{label}</span>
      <span className={cx("text-title tabular", tone === "coral" && "text-coral-text")}>
        {value}
      </span>
      {hint ? <span className="truncate text-caption font-normal text-muted">{hint}</span> : null}
    </div>
  );
}

/** A row of stats that wraps on narrow screens. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{children}</div>;
}
