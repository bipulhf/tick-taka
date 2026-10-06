import {
  addDays,
  endOfLocalDay,
  type LocalDate,
  localParts,
  startOfLocalDay,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { defined } from "@tick-taka/shared/defined";
import { and, eq, gte, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { tasks } from "../../db/schema/time";
import type { Deps } from "../../lib/deps";
import { userTime } from "../../lib/user-time";
import type { Task } from "./service";

/**
 * Moving many tasks at once: every overdue task to a day (or the inbox), and the
 * lowest-priority tasks of a full day to the next. Each reply names the tasks as
 * they were, so the phone can say what moved and undo it.
 */

const OPEN_STATUSES = ["inbox", "open"] as const;
const PRIORITY_RANK = { low: 0, normal: 1, high: 2 } as const;

/** A moved task as it was before a bulk move, so the phone can name it and undo the move. */
export type TaskBefore = Pick<
  Task,
  "id" | "title" | "status" | "doAt" | "hasTime" | "reminderAt" | "top3Date"
>;

const before = (task: Task): TaskBefore => ({
  id: task.id,
  title: task.title,
  status: task.status,
  doAt: task.doAt,
  hasTime: task.hasTime,
  reminderAt: task.reminderAt,
  top3Date: task.top3Date,
});

/**
 * One tap moves every overdue task to today, tomorrow or back to the inbox. The
 * reply lists the moved rows with their new stamp, so an edit the phone queued
 * after the tap can be lifted past it (last write wins).
 */
export function rescueOverdue(
  deps: Deps,
  target: "today" | "tomorrow" | "inbox",
  date?: LocalDate,
): { moved: number; before: TaskBefore[]; tasks: Task[] } {
  const db = deps.db;
  const { timeZone, today: localToday } = userTime(deps);
  const today = date ?? localToday;
  const startOfToday = startOfLocalDay(today, timeZone);
  const overdue = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        inArray(tasks.status, OPEN_STATUSES),
        lt(tasks.doAt, startOfToday),
      ),
    )
    .all();
  const time = deps.now();
  db.transaction((tx) => {
    for (const task of overdue) {
      if (target === "inbox") {
        tx.update(tasks)
          .set({
            status: "inbox",
            doAt: null,
            hasTime: false,
            reminderAt: null,
            top3Date: null,
            updatedAt: time,
          })
          .where(eq(tasks.id, task.id))
          .run();
        continue;
      }
      const day = target === "today" ? today : addDays(today, 1);
      const dayStart = startOfLocalDay(day, timeZone);
      let doAt = dayStart;
      if (task.hasTime && task.doAt !== null) {
        const { hour, minute } = localParts(task.doAt, timeZone);
        const [y, m, d] = day.split("-").map(Number) as [number, number, number];
        doAt = zonedTimeToUtc({ year: y, month: m, day: d, hour, minute }, timeZone);
      }
      const shift = doAt - defined(task.doAt, "an overdue task's date");
      tx.update(tasks)
        .set({
          doAt,
          reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
          status: task.status === "inbox" ? "open" : task.status,
          updatedAt: time,
        })
        .where(eq(tasks.id, task.id))
        .run();
    }
  });
  const ids = overdue.map((task) => task.id);
  const moved = ids.length ? db.select().from(tasks).where(inArray(tasks.id, ids)).all() : [];
  return { moved: overdue.length, before: overdue.map(before), tasks: moved };
}

/**
 * "Does my day fit?" overflow: moves the lowest-priority tasks planned for `date`
 * (never the top three) to the next day until enough minutes are freed.
 */
export function moveLowPriority(
  deps: Deps,
  date: LocalDate,
  minutesToFree: number,
): { moved: Task[]; before: TaskBefore[] } {
  const db = deps.db;
  const { timeZone } = userTime(deps);
  const from = startOfLocalDay(date, timeZone);
  const candidates = db
    .select()
    .from(tasks)
    .where(
      and(
        isNull(tasks.deletedAt),
        isNull(tasks.parentId),
        inArray(tasks.status, OPEN_STATUSES),
        gte(tasks.doAt, from),
        lt(tasks.doAt, endOfLocalDay(date, timeZone)),
        or(isNull(tasks.top3Date), ne(tasks.top3Date, date)),
      ),
    )
    .all()
    .filter((task) => task.whenSlot === "day")
    .sort(
      (a, b) =>
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        (b.estimateMin ?? 30) - (a.estimateMin ?? 30),
    );
  const moved: Task[] = [];
  const previous: TaskBefore[] = [];
  let freed = 0;
  const time = deps.now();
  const nextDayStart = startOfLocalDay(addDays(date, 1), timeZone);
  db.transaction((tx) => {
    for (const task of candidates) {
      if (freed >= minutesToFree) break;
      const taskDoAt = defined(task.doAt, "a scheduled task's date");
      const doAt = nextDayStart + (taskDoAt - from);
      const shift = doAt - taskDoAt;
      tx.update(tasks)
        .set({
          doAt,
          reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
          updatedAt: time,
        })
        .where(eq(tasks.id, task.id))
        .run();
      freed += task.estimateMin ?? 30;
      moved.push({ ...task, doAt, updatedAt: time });
      previous.push(before(task));
    }
  });
  return { moved, before: previous };
}
