import { localParts, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { CalendarDays, X } from "lucide-react";
import { Popover } from "radix-ui";
import { useId, useState } from "react";
import { useTodayDate, useUserTime } from "@/lib/use-today";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { dateFieldLabel, dateFromLocal, localFromDate, withinBounds } from "./calendar-dates";
import { cx } from "./cx";
import { Field, inputClass } from "./text-field";

/**
 * A local day ("YYYY-MM-DD"): a field showing the day ("Mon 5 Oct") that opens the
 * calendar in a popover. Enter or Space opens it, arrows move between days, Escape
 * closes it and returns to the field. Today is one click; an optional day can be
 * cleared. The week starts on the day chosen in Settings.
 */
export function DateField({
  label,
  value,
  onChange,
  clearable,
  min,
  max,
  hint,
  disabled,
  className,
}: {
  label?: string;
  value: string | null;
  onChange: (value: string | null) => void;
  clearable?: boolean;
  min?: string;
  max?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const today = useTodayDate();
  const { weekStartsOn } = useUserTime();
  const selected = value ? dateFromLocal(value) : undefined;
  const shown = value && selected ? dateFieldLabel(value, today) : null;
  const first = min ? dateFromLocal(min) : undefined;
  const last = max ? dateFromLocal(max) : undefined;
  const pick = (date: string | null) => {
    setOpen(false);
    onChange(date);
  };
  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Popover.Trigger asChild>
            <button
              id={id}
              type="button"
              disabled={disabled}
              aria-label={`${label ?? "Date"}: ${shown ?? "no day"}`}
              className={cx(
                inputClass,
                "flex h-10 items-center gap-2 text-left tabular data-[state=open]:border-sky-text data-[state=open]:ring-2 data-[state=open]:ring-sky/25",
                clearable && value && "pr-9",
              )}
            >
              <CalendarDays aria-hidden className="size-4 shrink-0 text-muted" />
              <span className={cx("truncate", !shown && "text-muted")}>
                {shown ?? "Pick a day"}
              </span>
            </button>
          </Popover.Trigger>
          {clearable && value && !disabled ? (
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
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={6}
            collisionPadding={8}
            aria-label={label ?? "Pick a day"}
            // Escape closes only the calendar, not an inline form or panel around it.
            onKeyDown={(event) => {
              if (event.key === "Escape") event.stopPropagation();
            }}
            className="z-50 animate-fade-in rounded-2xl border border-line bg-card shadow-xl shadow-ink/10"
          >
            <Calendar
              mode="single"
              required
              autoFocus
              selected={selected}
              defaultMonth={selected ?? first ?? dateFromLocal(today)}
              onSelect={(date) => pick(localFromDate(date))}
              today={dateFromLocal(today)}
              weekStartsOn={weekStartsOn as 0 | 1 | 2 | 3 | 4 | 5 | 6}
              startMonth={first}
              endMonth={last}
              disabled={[...(first ? [{ before: first }] : []), ...(last ? [{ after: last }] : [])]}
            />
            <div className="flex items-center gap-2 border-t border-line px-3 py-2">
              {clearable && value ? (
                <Button size="sm" variant="ghost" onClick={() => pick(null)}>
                  Clear
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto"
                disabled={!withinBounds(today, min, max)}
                onClick={() => pick(today)}
              >
                Today
              </Button>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
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
