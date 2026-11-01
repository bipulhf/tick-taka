import {
  localParts,
  parseLocalDate,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";

/** The fields a move reads from a task. */
export interface Movable {
  doAt: number | null;
  hasTime: boolean;
  status: "inbox" | "open" | "someday" | "done";
  reminderAt: number | null;
}

/**
 * What moving a task to another day changes: the day, keeping its time of day if it
 * has one, and its reminder shifted by the same amount. An inbox or someday task
 * becomes planned. Pure.
 */
export function dayMove(task: Movable, date: string, timeZone: string) {
  let doAt = startOfLocalDay(date, timeZone);
  if (task.hasTime && task.doAt !== null) {
    const { hour, minute } = localParts(task.doAt, timeZone);
    doAt = zonedTimeToUtc({ ...parseLocalDate(date), hour, minute }, timeZone);
  }
  const shift = task.doAt === null ? 0 : doAt - task.doAt;
  return {
    doAt,
    status: task.status === "inbox" || task.status === "someday" ? ("open" as const) : task.status,
    reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
  };
}

/** What placing a task at a minute of a day changes; the reminder rings then. Pure. */
export function timeMove(task: Movable, date: string, minuteOfDay: number, timeZone: string) {
  const doAt = zonedTimeToUtc(
    { ...parseLocalDate(date), hour: Math.floor(minuteOfDay / 60), minute: minuteOfDay % 60 },
    timeZone,
  );
  return {
    doAt,
    hasTime: true,
    reminderAt: doAt,
    status: task.status === "done" ? ("done" as const) : ("open" as const),
  };
}

/** Back to the inbox, with no day, time or reminder. */
export const UNSCHEDULE = {
  doAt: null,
  hasTime: false,
  reminderAt: null,
  status: "inbox" as const,
};

/** "HH:MM" to a minute of the day, or null. */
export function minuteOf(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const minute = Number(match[1]) * 60 + Number(match[2]);
  return minute >= 0 && minute < 24 * 60 ? minute : null;
}

/** Parked for later: no day, time or reminder, and off Today. */
export const SOMEDAY = {
  doAt: null,
  hasTime: false,
  reminderAt: null,
  status: "someday" as const,
};
