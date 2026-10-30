import { cx } from "./cx";

/** A quiet placeholder block in the shape of what is loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx("animate-pulse rounded-xl bg-line/70", className)} />;
}

/** A grouped list's worth of placeholder rows. */
export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden className="overflow-hidden rounded-2xl bg-card">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder rows
        <div key={i} className="flex h-[52px] items-center gap-3 border-line px-4 [&+&]:border-t">
          <Skeleton className="size-6 rounded-full" />
          <Skeleton className={cx("h-3.5", i % 2 ? "w-2/5" : "w-3/5")} />
          <Skeleton className="ml-auto h-3.5 w-14" />
        </div>
      ))}
    </div>
  );
}

/** A whole view loading: title, then a couple of grouped lists. */
export function ViewSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-7">
      <Skeleton className="h-8 w-48" />
      <SkeletonRows rows={3} />
      <SkeletonRows rows={5} />
    </div>
  );
}
