import { localParts, startOfLocalDay, zonedTimeToUtc } from "@tick-taka/shared/dates";

/**
 * Where the evening shutdown got to, kept for the tab (sessionStorage) so a reload
 * or a trip to another view comes back to the same step. A new day starts fresh.
 * Pure apart from the storage it is handed.
 */

const KEY = "tt.shutdown";

export interface ShutdownProgress<H> {
  date: string;
  step: number;
  /** Habits ticked during this shutdown, so they stay listed (and can be unticked). */
  ticked: H[];
  finished: boolean;
}

export function freshProgress<H>(date: string): ShutdownProgress<H> {
  return { date, step: 0, ticked: [], finished: false };
}

export function readProgress<H>(
  storage: Pick<Storage, "getItem"> | undefined,
  date: string,
): ShutdownProgress<H> {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return freshProgress(date);
    const saved = JSON.parse(raw) as Partial<ShutdownProgress<H>>;
    if (saved.date !== date) return freshProgress(date);
    return {
      date,
      step: typeof saved.step === "number" && saved.step >= 0 ? Math.floor(saved.step) : 0,
      ticked: Array.isArray(saved.ticked) ? saved.ticked : [],
      finished: saved.finished === true,
    };
  } catch {
    return freshProgress(date);
  }
}

export function saveProgress<H>(
  storage: Pick<Storage, "setItem"> | undefined,
  progress: ShutdownProgress<H>,
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage can be full or refused; progress then lasts until the page reloads.
  }
}

interface Movable {
  doAt: number | null;
  hasTime: boolean;
  reminderAt: number | null;
}

/**
 * A task carried over to `day`: the same clock time if it had one, else the start
 * of that day; a reminder moves by the same amount so it rings on the new day.
 */
export function carriedTo(task: Movable, day: string, timeZone: string) {
  let doAt = startOfLocalDay(day, timeZone);
  if (task.hasTime && task.doAt !== null) {
    const time = localParts(task.doAt, timeZone);
    const [year, month, date] = day.split("-").map(Number) as [number, number, number];
    doAt = zonedTimeToUtc(
      { year, month, day: date, hour: time.hour, minute: time.minute },
      timeZone,
    );
  }
  const shift = task.doAt === null ? 0 : doAt - task.doAt;
  return {
    doAt,
    reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
  };
}
