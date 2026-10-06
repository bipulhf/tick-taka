import { DAY_MS, type InstantRange, MINUTE_MS, toLocalDate } from "@tick-taka/shared/dates";
import type {
  timeEntryCreateSchema,
  timeEntryListQuerySchema,
  timeEntryUpdateSchema,
  timerStartSchema,
  timerStopSchema,
} from "@tick-taka/shared/schemas/time";
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, or, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { tasks, timeEntries } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest, conflict, notFound } from "../../lib/errors";

export type TimeEntry = typeof timeEntries.$inferSelect;

/** How far ahead of the server a phone's clock may run; such tap times count as now. */
const MAX_CLOCK_SKEW_MS = 30 * MINUTE_MS;
/** Oldest tap time accepted: an outbox can hold writes for days, not months. */
const MAX_TAP_AGE_MS = 30 * DAY_MS;
/** A stop arriving this soon after the timer stopped is a retry or a double tap. */
const STOP_REPLAY_WINDOW_MS = 2 * MINUTE_MS;

/**
 * The phone's tap time when it sent one, checked against the server clock. A tap
 * can't be in the future, so a phone clock running some minutes fast means "now".
 */
function tapTime(value: number | undefined, now: number): number | undefined {
  if (value === undefined) return undefined;
  if (value > now + MAX_CLOCK_SKEW_MS) throw badRequest("That time is in the future");
  if (value < now - MAX_TAP_AGE_MS) throw badRequest("That time is too long ago");
  return Math.min(value, now);
}

/** Minutes of `entry` that fall inside `range`; running entries count up to `now`. */
export function overlapMinutes(
  entry: Pick<TimeEntry, "startedAt" | "endedAt">,
  range: InstantRange,
  now: number,
) {
  const end = Math.min(entry.endedAt ?? now, range.to);
  const start = Math.max(entry.startedAt, range.from);
  return end > start ? (end - start) / MINUTE_MS : 0;
}

export function timeEntryService(deps: Deps) {
  const base = crud(deps.db, timeEntries, "Time entry", deps.now);
  const db = deps.db;

  function linkFromTask(taskId: string | null | undefined) {
    if (!taskId) return {};
    const task = db
      .select({ areaId: tasks.areaId, projectId: tasks.projectId })
      .from(tasks)
      .where(eq(tasks.id, taskId))
      .get();
    return task ? { areaId: task.areaId, projectId: task.projectId } : {};
  }

  /** Entries that overlap the range (not only those starting inside it). */
  function inRange(range: InstantRange, extra?: SQL): TimeEntry[] {
    return db
      .select()
      .from(timeEntries)
      .where(
        and(
          isNull(timeEntries.deletedAt),
          lt(timeEntries.startedAt, range.to),
          or(isNull(timeEntries.endedAt), gte(timeEntries.endedAt, range.from)),
          extra,
        ),
      )
      .orderBy(asc(timeEntries.startedAt))
      .all();
  }

  const service = {
    ...base,

    running(): TimeEntry | null {
      return (
        db
          .select()
          .from(timeEntries)
          .where(and(isNull(timeEntries.deletedAt), isNull(timeEntries.endedAt)))
          .orderBy(desc(timeEntries.startedAt))
          .get() ?? null
      );
    },

    /** Starts the single running entry, stopping any other first. */
    start(input: z.output<typeof timerStartSchema>): {
      started: TimeEntry;
      stopped: TimeEntry | null;
    } {
      return db.transaction(() => {
        if (input.id) {
          const existing = base.find(input.id, true);
          if (existing) return { started: existing, stopped: null };
        }
        const now = deps.now();
        const startedAt = tapTime(input.at ?? input.startedAt, now) ?? now;
        const current = service.running();
        const stopped = current
          ? base.update(current.id, { endedAt: Math.max(startedAt, current.startedAt) })
          : null;
        const link = linkFromTask(input.taskId);
        const started = base.create({
          id: input.id,
          taskId: input.taskId ?? null,
          areaId: input.areaId ?? link.areaId ?? null,
          projectId: input.projectId ?? link.projectId ?? null,
          startedAt,
          endedAt: null,
          source: input.source,
          billable: input.billable,
          note: input.note ?? null,
        });
        return { started, stopped };
      });
    },

    /**
     * Stops the running entry (or the one named by `id`). Replays succeed: a stop for an
     * entry that already stopped, or one matching the last stop, returns that entry.
     */
    stop(input: z.output<typeof timerStopSchema> = {}): TimeEntry {
      const now = deps.now();
      const tapped = tapTime(input.at ?? input.endedAt, now);
      const end = tapped ?? now;
      let current: TimeEntry | null;
      if (input.id) {
        current = base.find(input.id, true) ?? null;
        if (!current) throw notFound("Time entry");
        if (current.endedAt !== null) return current;
      } else {
        current = service.running();
      }
      if (!current) {
        const last = db
          .select()
          .from(timeEntries)
          .where(and(isNull(timeEntries.deletedAt), isNotNull(timeEntries.endedAt)))
          .orderBy(desc(timeEntries.updatedAt))
          .get();
        const replay =
          last && (last.endedAt === tapped || now - last.updatedAt <= STOP_REPLAY_WINDOW_MS);
        if (last && replay) return last;
        throw conflict("No timer is running");
      }
      if (end <= current.startedAt) throw badRequest("Stop time must be after the start");
      return base.update(current.id, { endedAt: end });
    },

    list(query: z.output<typeof timeEntryListQuerySchema>): TimeEntry[] {
      const filters: SQL[] = [];
      if (query.areaId) filters.push(eq(timeEntries.areaId, query.areaId));
      if (query.taskId) filters.push(eq(timeEntries.taskId, query.taskId));
      const range = { from: query.from ?? 0, to: query.to ?? Number.MAX_SAFE_INTEGER };
      return inRange(range, and(...filters));
    },

    create(input: z.output<typeof timeEntryCreateSchema>): TimeEntry {
      const link = linkFromTask(input.taskId);
      return base.create({
        ...input,
        taskId: input.taskId ?? null,
        areaId: input.areaId ?? link.areaId ?? null,
        projectId: input.projectId ?? link.projectId ?? null,
        note: input.note ?? null,
      });
    },

    update(id: string, input: z.output<typeof timeEntryUpdateSchema>): TimeEntry {
      const current = base.get(id);
      const startedAt = input.startedAt ?? current.startedAt;
      const endedAt = input.endedAt === undefined ? current.endedAt : input.endedAt;
      if (endedAt !== null && endedAt <= startedAt) throw badRequest("End must be after start");
      return base.update(id, input);
    },

    /** Minutes per area within the range, total and focus-only. */
    minutesByArea(
      range: InstantRange,
    ): { areaId: string | null; minutes: number; focusMinutes: number }[] {
      const now = deps.now();
      const totals = new Map<string | null, { minutes: number; focusMinutes: number }>();
      for (const entry of inRange(range)) {
        const minutes = overlapMinutes(entry, range, now);
        const bucket = totals.get(entry.areaId) ?? { minutes: 0, focusMinutes: 0 };
        bucket.minutes += minutes;
        if (entry.source === "focus") bucket.focusMinutes += minutes;
        totals.set(entry.areaId, bucket);
      }
      return [...totals.entries()].map(([areaId, value]) => ({
        areaId,
        minutes: Math.round(value.minutes),
        focusMinutes: Math.round(value.focusMinutes),
      }));
    },

    /** Focus statistics: focus minutes per area and per local day, and session count. */
    focusStats(range: InstantRange, timeZone: string) {
      const now = deps.now();
      const entries = inRange(range, eq(timeEntries.source, "focus"));
      const byDay = new Map<string, number>();
      const byArea = new Map<string | null, number>();
      for (const entry of entries) {
        const minutes = overlapMinutes(entry, range, now);
        const day = toLocalDate(Math.max(entry.startedAt, range.from), timeZone);
        byDay.set(day, (byDay.get(day) ?? 0) + minutes);
        byArea.set(entry.areaId, (byArea.get(entry.areaId) ?? 0) + minutes);
      }
      return {
        sessions: entries.filter((e) => e.endedAt !== null).length,
        totalMinutes: Math.round([...byArea.values()].reduce((a, b) => a + b, 0)),
        byArea: [...byArea.entries()].map(([areaId, minutes]) => ({
          areaId,
          minutes: Math.round(minutes),
        })),
        byDay: [...byDay.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, minutes]) => ({ date, minutes: Math.round(minutes) })),
      };
    },
  };
  return service;
}
