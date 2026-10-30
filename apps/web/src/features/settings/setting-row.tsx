import type { ReactNode } from "react";
import { Chip } from "@/components/ui/chip";
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

/** A small label over a group inside a section ("Focus", "Advanced views"). */
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
