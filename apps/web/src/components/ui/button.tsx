import type { LucideIcon } from "lucide-react";
import { type ButtonHTMLAttributes, forwardRef } from "react";
import { cx } from "./cx";

export type ButtonVariant = "primary" | "secondary" | "time" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // Mango is the one primary action of a view; its text is always dark.
  primary: "bg-mango text-on-mango hover:brightness-[1.04] active:brightness-95",
  secondary: "border border-line-strong bg-card text-ink hover:bg-line/40 active:bg-line/70",
  // Time actions (start a timer, schedule) keep the outline and get a sky icon.
  time: "border border-line-strong bg-card text-ink hover:bg-line/40 active:bg-line/70",
  ghost: "text-ink hover:bg-line/50 active:bg-line/80",
  danger: "text-coral-text hover:bg-coral/10 active:bg-coral/20",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 rounded-xl px-3 text-callout",
  md: "h-10 gap-2 rounded-xl px-4 text-body",
  lg: "h-12 gap-2 rounded-2xl px-5 text-body",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Shows the work on the button itself and blocks a second click. */
  loading?: boolean;
  /** Stretches across its container, for panel footers. */
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "md",
    icon: Icon,
    loading,
    block,
    className,
    children,
    disabled,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        "inline-flex shrink-0 items-center justify-center font-bold whitespace-nowrap transition-[background-color,filter,opacity] duration-150 select-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      ) : Icon ? (
        <Icon
          aria-hidden
          className={cx(size === "sm" ? "size-4" : "size-[18px]", variant === "time" && "text-sky")}
          strokeWidth={2.2}
        />
      ) : null}
      {children}
    </button>
  );
});
