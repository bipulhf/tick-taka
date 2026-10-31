import { ChevronRight } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Chip } from "@/components/ui/chip";
import { cx } from "@/components/ui/cx";
import { Select, type SelectOption } from "@/components/ui/select";

/** One setting in a grouped list: what it is on the left, its control on the right. */
export function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      <div className="min-w-[12rem] flex-1">
        <div className="text-body font-semibold">{label}</div>
        {description ? <div className="text-callout text-muted">{description}</div> : null}
      </div>
      {children}
    </div>
  );
}

/** A setting picked from a short list: the "Cash ▾" field, labelled by its row. */
export function SelectRow<V extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  description?: ReactNode;
  value: V | null | undefined;
  options: SelectOption<V>[];
  onChange: (value: V) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow label={label} description={description}>
      <Select
        ariaLabel={label}
        value={value}
        options={options}
        onChange={onChange}
        disabled={disabled}
        size="sm"
        className="w-full sm:w-60"
      />
    </SettingRow>
  );
}

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const LONG_DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Several days can be picked, so these stay chips (each one a toggle), not a picker. */
export function DaysRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <SettingRow label={label} description={description}>
      <fieldset aria-label={label} className="flex flex-wrap gap-1.5">
        {DAYS.map((day, i) => (
          <Chip
            key={day}
            selected={value.includes(i)}
            aria-label={LONG_DAYS[i]}
            onClick={() =>
              onChange(
                value.includes(i)
                  ? value.filter((d) => d !== i)
                  : [...value, i].sort((a, b) => a - b),
              )
            }
          >
            {day}
          </Chip>
        ))}
      </fieldset>
    </SettingRow>
  );
}

/** Two short pickers side by side in one row ("Sunday at 7:00 pm", "11 pm to 7 am"). */
export function PairRow<A extends string, B extends string>({
  label,
  description,
  first,
  joiner,
  second,
}: {
  label: string;
  description?: ReactNode;
  first: { label: string; value: A; options: SelectOption<A>[]; onChange: (value: A) => void };
  joiner: string;
  second: { label: string; value: B; options: SelectOption<B>[]; onChange: (value: B) => void };
}) {
  return (
    <SettingRow label={label} description={description}>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Select
          ariaLabel={first.label}
          value={first.value}
          options={first.options}
          onChange={first.onChange}
          size="sm"
          className="flex-1 sm:w-36"
        />
        <span className="text-callout text-muted">{joiner}</span>
        <Select
          ariaLabel={second.label}
          value={second.value}
          options={second.options}
          onChange={second.onChange}
          size="sm"
          className="flex-1 sm:w-36"
        />
      </div>
    </SettingRow>
  );
}

/**
 * Settings most people never change, folded away until asked for. The label says how
 * many are inside, so nothing feels hidden.
 */
export function MoreOptions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 self-start rounded-lg px-1 py-0.5 text-callout font-bold text-sky-text hover:bg-sky/10"
      >
        <ChevronRight
          aria-hidden
          className={cx("size-4 transition-transform duration-150", open && "rotate-90")}
        />
        {label}
      </button>
      {open ? (
        <div id={id} className="flex flex-col gap-3">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** A small label over a group inside a section ("Time off"). */
export function GroupLabel({ children }: { children: ReactNode }) {
  return <h3 className="mt-2 px-1 text-caption text-muted">{children}</h3>;
}

/** "9:30 pm" for a stored "21:30", as the phone's clock pickers say it. */
export function clockLabel(time: string): string {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function clockOptions(times: string[]): SelectOption<string>[] {
  return times.map((time) => ({ value: time, label: clockLabel(time) }));
}
