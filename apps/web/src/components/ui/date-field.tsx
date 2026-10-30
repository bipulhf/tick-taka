import { localParts, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { X } from "lucide-react";
import { useId } from "react";
import { cx } from "./cx";
import { Field, inputClass } from "./text-field";

/** A local day ("YYYY-MM-DD"), with the browser's own date picker. */
export function DateField({
  label,
  value,
  onChange,
  clearable,
  min,
  max,
  hint,
  className,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
  min?: string;
  max?: string;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <div className="relative">
        <input
          id={id}
          type="date"
          value={value ?? ""}
          min={min}
          max={max}
          onChange={(event) => onChange(event.target.value || null)}
          className={cx(inputClass, "h-10 tabular", clearable && value && "pr-9")}
        />
        {clearable && value ? (
          <button
            type="button"
            aria-label={`Clear ${label ?? "date"}`}
            onClick={() => onChange(null)}
            className="absolute inset-y-0 right-1.5 my-auto flex size-7 items-center justify-center rounded-lg text-muted hover:bg-line/60 hover:text-ink"
          >
            <X aria-hidden className="size-4" />
          </button>
        ) : null}
      </div>
    </Field>
  );
}

/** "HH:MM" on a 24-hour clock, with the browser's own time picker. */
export function TimeField({
  label,
  value,
  onChange,
  className,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} className={className}>
      <input
        id={id}
        type="time"
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
        className={cx(inputClass, "h-10 tabular")}
      />
    </Field>
  );
}

/** The local day and "HH:MM" of an instant in a time zone. */
export function splitInstant(ms: number, timeZone: string): { date: string; time: string } {
  const p = localParts(ms, timeZone);
  return {
    date: toLocalDate(ms, timeZone),
    time: `${String(p.hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}`,
  };
}

/** The instant of a local day and "HH:MM" in a time zone. */
export function joinInstant(date: string, time: string, timeZone: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const [hour, minute] = time.split(":").map(Number) as [number, number];
  return zonedTimeToUtc({ year, month, day, hour, minute }, timeZone);
}
