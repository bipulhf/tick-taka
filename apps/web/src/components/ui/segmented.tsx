import { cx } from "./cx";

/**
 * - choice: picks a value (Light / Dark, Expense / Income); a radio group.
 * - tabs: switches what the view below shows; use links for routes instead.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** What the group chooses, for screen readers ("Theme"). */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx("inline-flex rounded-xl bg-line/60 p-0.5", className)}
    >
      {options.map((option) => {
        const on = option.value === value;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a segmented control, styled as one bar
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(option.value)}
            className={cx(
              "flex-1 rounded-[10px] px-3 font-bold whitespace-nowrap transition-colors duration-150",
              size === "sm" ? "h-7 text-caption" : "h-8 text-callout",
              on ? "bg-card text-ink shadow-sm" : "text-muted hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
