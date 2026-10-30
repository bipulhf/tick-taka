import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx";

/** An action or one choice of several. Selected = ink fill, never mango. */
export function Chip({
  selected,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={cx(
        "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-callout font-semibold whitespace-nowrap transition-colors duration-150",
        selected
          ? "bg-ink text-background"
          : "border border-line bg-card text-ink hover:border-line-strong",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
