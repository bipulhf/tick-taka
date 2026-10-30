import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** One rounded surface; rows inside are separated by hairlines. */
export function Group({
  children,
  className,
  as: Tag = "div",
  label,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol";
  label?: string;
}) {
  return (
    <Tag
      aria-label={label}
      className={cx(
        "overflow-hidden rounded-2xl bg-card [&>*+*]:border-t [&>*+*]:border-line",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export interface RowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** An icon, emoji circle or checkbox before the title. */
  leading?: ReactNode;
  /** One trailing value (an amount, a time) or a control. */
  trailing?: ReactNode;
  onClick?: () => void;
  /** Shows a chevron: the row opens something. */
  chevron?: boolean;
  selected?: boolean;
  className?: string;
  as?: "div" | "li";
  /** For keyboard list navigation (lib/use-list-keys.ts). */
  dataKey?: string;
  muted?: boolean;
}

/**
 * A list row: leading mark, title, optional subtitle, one trailing value. When
 * `onClick` is set the title is a button covering the row, so nested controls
 * (a checkbox, a menu) keep their own targets.
 */
export function Row({
  title,
  subtitle,
  leading,
  trailing,
  onClick,
  chevron,
  selected,
  className,
  as: Tag = "div",
  dataKey,
  muted,
}: RowProps) {
  return (
    <Tag
      data-row={dataKey}
      aria-selected={selected || undefined}
      className={cx(
        "group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2.5 transition-colors duration-150",
        onClick && "hover:bg-line/30",
        selected && "bg-line/50 hover:bg-line/50",
        className,
      )}
    >
      {leading ? <div className="relative z-10 flex shrink-0 items-center">{leading}</div> : null}
      <div className="min-w-0 flex-1">
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            className="block w-full truncate text-left text-body font-semibold after:absolute after:inset-0 after:content-[''] focus-visible:outline-none after:focus-visible:rounded-2xl after:focus-visible:ring-2 after:focus-visible:ring-sky-text after:focus-visible:ring-inset"
          >
            <span className={cx(muted && "text-muted line-through decoration-line-strong")}>
              {title}
            </span>
          </button>
        ) : (
          <div className={cx("truncate text-body font-semibold", muted && "text-muted")}>
            {title}
          </div>
        )}
        {subtitle ? <div className="truncate text-callout text-muted">{subtitle}</div> : null}
      </div>
      {trailing ? (
        <div className="relative z-10 flex shrink-0 items-center gap-2 text-body">{trailing}</div>
      ) : null}
      {chevron ? <ChevronRight aria-hidden className="size-4 shrink-0 text-muted" /> : null}
    </Tag>
  );
}

/** A soft round mark for a row: emoji or icon on a tinted circle. */
export function RowMark({
  emoji,
  icon: Icon,
  tone = "neutral",
  size = "md",
}: {
  emoji?: string | null;
  icon?: LucideIcon;
  tone?: "neutral" | "sky" | "mint" | "coral" | "grape" | "mango";
  size?: "sm" | "md";
}) {
  const bg = {
    neutral: "bg-line/60 text-ink",
    sky: "bg-sky/15 text-sky-text",
    mint: "bg-mint/15 text-mint-text",
    coral: "bg-coral/15 text-coral-text",
    grape: "bg-grape/15 text-grape-text",
    mango: "bg-mango/20 text-mango-text",
  }[tone];
  return (
    <span
      aria-hidden
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "sm" ? "size-7 text-callout" : "size-9 text-body",
        bg,
      )}
    >
      {emoji ? (
        emoji
      ) : Icon ? (
        <Icon className={size === "sm" ? "size-3.5" : "size-[18px]"} />
      ) : null}
    </span>
  );
}
