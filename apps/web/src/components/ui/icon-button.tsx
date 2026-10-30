import type { LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "./cx";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon;
  /** Read by screen readers and shown as the tooltip. */
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
  /** A toggle that is on: marked by ink and a soft pill, never by colour alone. */
  pressed?: boolean;
  tooltip?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Icon, label, shortcut, size = "md", pressed, tooltip = true, className, ...props },
  ref,
) {
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-xl text-muted transition-colors duration-150 hover:bg-line/60 hover:text-ink disabled:opacity-40",
        size === "sm" ? "size-8" : "size-10",
        pressed && "bg-line/70 text-ink",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={size === "sm" ? "size-4" : "size-5"} strokeWidth={2} />
    </button>
  );
  return tooltip ? (
    <Tooltip label={label} shortcut={shortcut}>
      {button}
    </Tooltip>
  ) : (
    button
  );
});
