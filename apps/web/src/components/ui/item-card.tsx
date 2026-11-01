import type { ReactNode } from "react";
import { type RowKeyActions, useRowKeyActions } from "@/lib/row-keys";
import { cx } from "./cx";
import { Skeleton } from "./skeleton";

/**
 * Cards for things with a shape of their own (a goal's ring, a loan's progress, an
 * event's budget), side by side: one column on a phone, two from 640 px, three from
 * 1280 px. Cards keep their own height, so one opening a form doesn't stretch the rest.
 */
export function CardGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul
      aria-label={label}
      className="grid grid-cols-[minmax(0,1fr)] items-start gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {children}
    </ul>
  );
}

/**
 * One card in a CardGrid. Like a Row, the title is a button covering the card (Enter
 * and J / K reach it through `dataKey`); `menu` and `actions` sit above it and keep
 * their own targets, while `children` (figures, bars) open the card when clicked.
 */
export function ItemCard({
  dataKey,
  keyActions,
  onOpen,
  title,
  subtitle,
  leading,
  aside,
  menu,
  actions,
  children,
}: {
  /** Makes the card a stop for J / K, e.g. "goal:<id>". */
  dataKey: string;
  keyActions?: RowKeyActions;
  onOpen: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** A mark before the title (an emoji circle). */
  leading?: ReactNode;
  /** One value or state at the title's end (an amount, a StatusPill). */
  aside?: ReactNode;
  /** The card's "more" menu (RowMenu). */
  menu?: ReactNode;
  /** Buttons and inline forms at the card's foot. */
  actions?: ReactNode;
  children?: ReactNode;
}) {
  useRowKeyActions(dataKey, keyActions);
  return (
    <li
      data-row={dataKey}
      className="group/row relative flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-4 transition-colors duration-150 hover:bg-line/30 sm:p-5"
    >
      <div className="flex items-start gap-3">
        {leading ? <div className="flex shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <button
            type="button"
            data-row-primary
            onClick={onOpen}
            className="block w-full truncate text-left text-body font-bold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-2xl after:focus-visible:ring-2 after:focus-visible:ring-sky-text after:focus-visible:ring-inset"
          >
            {title}
          </button>
          {subtitle ? <div className="truncate text-callout text-muted">{subtitle}</div> : null}
        </div>
        {aside ? <div className="flex shrink-0 items-center self-center">{aside}</div> : null}
        {menu ? <div className="relative z-10 -mr-1.5 shrink-0 self-center">{menu}</div> : null}
      </div>
      {children}
      {actions ? <div className="relative z-10 flex flex-col gap-2">{actions}</div> : null}
    </li>
  );
}

/**
 * A CardGrid's worth of placeholder cards while it loads.
 * - figure "bar": a progress bar under the title (loans, events).
 * - figure "ring": a progress ring beside two lines (goals).
 */
export function ItemCardSkeletons({
  count = 3,
  figure = "bar",
}: {
  count?: number;
  figure?: "bar" | "ring";
}) {
  return (
    <div aria-hidden className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholder cards
        <div key={i} className="flex flex-col gap-4 rounded-2xl bg-card p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className={cx("h-3.5", i % 2 ? "w-2/5" : "w-1/2")} />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          {figure === "ring" ? (
            <div className="flex items-center gap-4">
              <Skeleton className="size-[72px] rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ) : (
            <Skeleton className="h-2 w-full rounded-full" />
          )}
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  );
}
