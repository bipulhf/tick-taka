import { formatClock } from "@/lib/format";

export interface PickerOption {
  id: string;
  label: string;
  emoji?: string;
}

/**
 * The options with the current value first when it isn't one of them, so a value
 * set elsewhere (by Tiki, an older preset, the server) still reads as itself
 * instead of "Choose". `describe` labels it; by default the id is shown as is.
 */
export function withCurrentOption(
  options: PickerOption[],
  value: string | null,
  describe: (id: string) => string = (id) => id,
): PickerOption[] {
  if (value === null || value === "" || options.some((o) => o.id === value)) return options;
  return [{ id: value, label: describe(value) }, ...options];
}

/** "21:00" → "9:00 pm", the way every other time in the app reads. */
export function clockLabel(time: string): string {
  const [hour = 0, minute = 0] = time.split(":").map(Number);
  return formatClock(Date.UTC(2000, 0, 1, hour, minute), "UTC");
}

/** Picker options for "HH:mm" times: the id stays "HH:mm", the label is "9:00 pm". */
export function clockOptions(times: string[]): PickerOption[] {
  return times.map((time) => ({ id: time, label: clockLabel(time) }));
}
