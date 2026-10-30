import { Check } from "lucide-react";
import { cx } from "./cx";

/**
 * The round task check. Unchecked is a ring in a `-text` token (its only cue, so
 * 3:1 on every surface); checked fills with the colour and a dark tick.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  tone = "sky",
  size = "md",
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What checking it does, e.g. "Complete Call bank". */
  label: string;
  tone?: "sky" | "grape" | "mint";
  size?: "sm" | "md";
  disabled?: boolean;
}) {
  const ring = {
    sky: "border-sky-text hover:bg-sky/10",
    grape: "border-grape-text hover:bg-grape/10",
    mint: "border-mint-text hover:bg-mint/10",
  }[tone];
  const fill = {
    sky: "bg-sky border-sky",
    grape: "bg-grape border-grape",
    mint: "bg-mint border-mint",
  }[tone];
  return (
    // biome-ignore lint/a11y/useSemanticElements: a round check styled beyond what <input type=checkbox> allows
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      className={cx(
        "group relative inline-flex shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 before:absolute before:-inset-2 before:content-['']",
        size === "sm" ? "size-[18px]" : "size-[22px]",
        checked ? cx(fill, "animate-check") : ring,
      )}
    >
      {checked ? <Check aria-hidden className="size-3.5 text-on-mango" strokeWidth={3.2} /> : null}
    </button>
  );
}
