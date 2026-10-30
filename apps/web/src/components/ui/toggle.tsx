import { Switch } from "radix-ui";
import { useId } from "react";
import { cx } from "./cx";

/** On = ink track with a background thumb (like a selected chip); off = line-strong. */
export function Toggle({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Needed when no visible label names the switch. */
  label?: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <Switch.Root
      id={id}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex h-6 w-10 shrink-0 items-center rounded-full bg-line-strong transition-colors duration-150 data-[state=checked]:bg-ink disabled:opacity-50"
    >
      <Switch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-background shadow-sm transition-transform duration-200 ease-out-quart data-[state=checked]:translate-x-[18px]" />
    </Switch.Root>
  );
}

/** Every on/off setting: a labelled row, and the whole row is the target. */
export function ToggleRow({
  label,
  description,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={cx(
        "flex min-h-14 cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-line/30",
        disabled && "cursor-default opacity-60",
        className,
      )}
    >
      <span className="flex-1">
        <span className="block text-body font-semibold">{label}</span>
        {description ? <span className="block text-callout text-muted">{description}</span> : null}
      </span>
      <Toggle id={id} checked={checked} onChange={onChange} disabled={disabled} />
    </label>
  );
}
