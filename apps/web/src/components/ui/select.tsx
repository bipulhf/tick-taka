import { Check, ChevronDown } from "lucide-react";
import { Select as S } from "radix-ui";
import { useId } from "react";
import { cx } from "./cx";
import { Field } from "./text-field";

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  /** Emoji or a short mark shown before the label. */
  leading?: string;
  hint?: string;
}

/** Radix Select can't hold an empty value; "none" options use this one. */
export const NONE = "__none__";

/**
 * A compact "Cash ▾" field that opens a list, instead of rows of chips. A value
 * set elsewhere that isn't among the options is listed as itself.
 */
export function Select<V extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose",
  hint,
  error,
  disabled,
  className,
  size = "md",
  ariaLabel,
}: {
  label?: string;
  value: V | null | undefined;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  placeholder?: string;
  hint?: string;
  error?: string | null;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  const id = useId();
  const known = value == null || options.some((o) => o.value === value);
  const all = known ? options : [...options, { value: value as V, label: String(value) }];
  return (
    <Field label={label} hint={hint} error={error} htmlFor={id} className={className}>
      <S.Root
        value={value ?? undefined}
        onValueChange={(v) => onChange(v as V)}
        disabled={disabled}
      >
        <S.Trigger
          id={id}
          aria-label={ariaLabel}
          aria-invalid={error ? true : undefined}
          className={cx(
            "inline-flex w-full items-center justify-between gap-2 rounded-xl border border-line-strong bg-card px-3 text-left text-ink transition-colors duration-150 hover:border-ink/60 focus:outline-none focus-visible:border-sky-text focus-visible:ring-2 focus-visible:ring-sky/25 disabled:opacity-60 data-[placeholder]:text-muted",
            size === "sm" ? "h-8 text-callout" : "h-10 text-body",
          )}
        >
          <S.Value placeholder={placeholder} />
          <S.Icon>
            <ChevronDown aria-hidden className="size-4 text-muted" />
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={4}
            className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] animate-fade-in overflow-hidden rounded-2xl border border-line bg-card p-1 shadow-xl shadow-ink/10"
          >
            <S.Viewport>
              {all.map((option) => (
                <S.Item
                  key={option.value}
                  value={option.value}
                  className="relative flex min-h-9 cursor-pointer items-center gap-2 rounded-xl py-1.5 pr-8 pl-3 text-body outline-none select-none data-[highlighted]:bg-line/60"
                >
                  {option.leading ? <span aria-hidden>{option.leading}</span> : null}
                  <S.ItemText>{option.label}</S.ItemText>
                  {option.hint ? (
                    <span className="ml-auto text-caption font-normal text-muted">
                      {option.hint}
                    </span>
                  ) : null}
                  <S.ItemIndicator className="absolute right-2.5">
                    <Check aria-hidden className="size-4" />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </Field>
  );
}
