import { cx } from "@/components/ui/cx";

/**
 * The phone's emoji picker as one row of choices (a radio group). An emoji picked
 * elsewhere that isn't a preset is listed first, as itself.
 */
export function EmojiGrid({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (emoji: string) => void;
}) {
  const all = value && !options.includes(value) ? [value, ...options] : options;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption text-muted">{label}</span>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {all.map((emoji) => {
          const on = emoji === value;
          return (
            // biome-ignore lint/a11y/useSemanticElements: an emoji swatch, styled beyond a radio input
            <button
              key={emoji}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={emoji}
              onClick={() => onChange(emoji)}
              className={cx(
                "flex size-10 items-center justify-center rounded-xl text-xl transition-colors duration-150",
                on ? "bg-ink/10 ring-2 ring-ink" : "bg-line/50 hover:bg-line",
              )}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </div>
  );
}
