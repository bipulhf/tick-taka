import {
  addDays,
  endOfLocalDay,
  type LocalDate,
  localParts,
  startOfLocalDay,
  toLocalDate,
  zonedTimeToUtc,
} from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import { nextOccurrence, parseRRule } from "@tick-taka/shared/recurrence";
import type { TaskCreate, TaskListQuery, TaskUpdate } from "@tick-taka/shared/schemas/time";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  like,
  lt,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import { tasks } from "../../db/schema/time";
import { crud } from "../../lib/crud";
import type { Deps } from "../../lib/deps";
import { badRequest, conflict } from "../../lib/errors";
import { userTime } from "../../lib/user-time";

export type Task = typeof tasks.$inferSelect;

const OPEN_STATUSES = ["inbox", "open"] as const;
const PRIORITY_RANK = { low: 0, normal: 1, high: 2 } as const;

export function taskService(deps: Deps) {
  const base = crud(deps.db, tasks, "Task", deps.now);
  const db = deps.db;

  function assertParent(parentId: string | null | undefined, selfId?: string) {
    if (!parentId) return null;
    if (parentId === selfId) throw badRequest("A task can't be its own subtask");
    const parent = base.get(parentId);
    if (parent.parentId) throw badRequest("Subtasks can't have subtasks (one level only)");
    if (selfId) {
      const hasChildren = db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(eq(tasks.parentId, selfId), isNull(tasks.deletedAt)))
        .get();
      if (hasChildren) throw badRequest("A task with subtasks can't become a subtask");
    }
    return parent;
  }

  function assertTopThreeRoom(date: string, selfId?: string) {
    const filters = [eq(tasks.top3Date, date), isNull(tasks.deletedAt)];
    if (selfId) filters.push(ne(tasks.id, selfId));
    const count = db
      .select({ n: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...filters))
      .get();
    if ((count?.n ?? 0) >= 3) throw conflict("Top three is full for that day. Swap one out first.");
  }

  /** The copy a repeating task leaves behind when completed. */
  function createNextOccurrence(task: Task, timeZone: string, today: LocalDate): Task | null {
    if (!task.rrule) return null;
    const anchorMs = task.doAt ?? startOfLocalDay(today, timeZone);
    const anchor = toLocalDate(anchorMs, timeZone);
    const next = nextOccurrence(task.rrule, anchor, anchor < today ? today : anchor);
    if (!next) return null;
    const rule = parseRRule(task.rrule);
    const [year, month, day] = next.split("-").map(Number) as [number, number, number];
    let doAt: number;
    if (rule.byHour !== undefined) {
      doAt = zonedTimeToUtc(
        { year, month, day, hour: rule.byHour, minute: rule.byMinute ?? 0 },
        timeZone,
      );
    } else if (task.hasTime && task.doAt !== null) {
      const parts = localParts(task.doAt, timeZone);
      doAt = zonedTimeToUtc({ year, month, day, hour: parts.hour, minute: parts.minute }, timeZone);
    } else {
      doAt = startOfLocalDay(next, timeZone);
    }
    const shift = doAt - anchorMs;
    const copy = base.create({
      title: task.title,
      notes: task.notes,
      status: "open",
      priority: task.priority,
      projectId: task.projectId,
      areaId: task.areaId,
      parentId: null,
      doAt,
      hasTime: task.hasTime || rule.byHour !== undefined,
      whenSlot: task.whenSlot,
      deadlineAt: task.deadlineAt === null ? null : task.deadlineAt + shift,
      energy: task.energy,
      estimateMin: task.estimateMin,
      reminderAt: task.reminderAt === null ? null : task.reminderAt + shift,
      rrule: task.rrule,
      top3Date: null,
      urgent: task.urgent,
      sort: task.sort,
      doneAt: null,
    });
    const subtasks = base.list(eq(tasks.parentId, task.id), asc(tasks.sort));
    for (const subtask of subtasks) {
      base.create({
        title: subtask.title,
        notes: subtask.notes,
        status: "open",
        priority: subtask.priority,
        projectId: copy.projectId,
        areaId: copy.areaId,
        parentId: copy.id,
        doAt: null,
        hasTime: false,
        whenSlot: subtask.whenSlot,
        deadlineAt: null,
        energy: subtask.energy,
        estimateMin: subtask.estimateMin,
        reminderAt: null,
        rrule: null,
        top3Date: null,
        urgent: false,
        sort: subtask.sort,
        doneAt: null,
      });
    }
    return copy;
  }

  return {
    ...base,

    list(query: Partial<TaskListQuery> = {}): Task[] {
      const filters: (SQL | undefined)[] = [];
      if (query.status?.length) filters.push(inArray(tasks.status, query.status));
      if (query.areaId) filters.push(eq(tasks.areaId, query.areaId));
      if (query.projectId) filters.push(eq(tasks.projectId, query.projectId));
      if (query.parentId) filters.push(eq(tasks.parentId, query.parentId));
      else if (!query.includeSubtasks) filters.push(isNull(tasks.parentId));
      if (query.from !== undefined) filters.push(gte(tasks.doAt, query.from));
      if (query.to !== undefined) filters.push(lt(tasks.doAt, query.to));
      if (query.doneFrom !== undefined) filters.push(gte(tasks.doneAt, query.doneFrom));
      if (query.doneTo !== undefined) filters.push(lt(tasks.doneAt, query.doneTo));
      if (query.top3Date) filters.push(eq(tasks.top3Date, query.top3Date));
      if (query.q) {
        const pattern = `%${query.q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
        filters.push(or(like(tasks.title, pattern), like(tasks.notes, pattern)));
      }
      const order =
        query.doneFrom !== undefined || query.status?.includes("done")
          ? desc(tasks.doneAt)
          : asc(tasks.sort);
      return db
        .select()
        .from(tasks)
        .where(and(isNull(tasks.deletedAt), ...filters))
        .orderBy(order, sql`${tasks.doAt} is null`, asc(tasks.doAt), asc(tasks.createdAt))
        .limit(query.limit ?? 200)
        .all();
    },

    create(input: TaskCreate): Task & { subtasks: Task[] } {
      const existing = input.id ? base.find(input.id, true) : undefined;
      if (existing)
        return {
          ...existing,
          subtasks: base.list(eq(tasks.parentId, existing.id), asc(tasks.sort)),
        };
      const parent = assertParent(input.parentId);
      if (input.top3Date) assertTopThreeRoom(input.top3Date);
      const { subtasks: subtaskTitles = [], ...fields } = input;
      const task = db.transaction(() => {
        const created = base.create({
          ...fields,
          notes: fields.notes ?? null,
          projectId: fields.projectId ?? parent?.projectId ?? null,
          areaId: fields.areaId ?? parent?.areaId ?? null,
          parentId: fields.parentId ?? null,
          doAt: fields.doAt ?? null,
          deadlineAt: fields.deadlineAt ?? null,
          energy: fields.energy ?? null,
          estimateMin: fields.estimateMin ?? null,
          reminderAt: fields.reminderAt ?? null,
          rrule: fields.rrule ?? null,
          top3Date: fields.top3Date ?? null,
          sort: fields.sort ?? 0,
          doneAt: fields.status === "done" ? deps.now() : null,
        });
        subtaskTitles.forEach((title, sort) => {
          base.create({
            id: newId(deps.now()),
            title,
            notes: null,
            status: "open",
            priority: "normal",
            projectId: created.projectId,
            areaId: created.areaId,
            parentId: created.id,
            doAt: null,
            hasTime: false,
            whenSlot: "day",
            deadlineAt: null,
            energy: null,
            estimateMin: null,
            reminderAt: null,
            rrule: null,
            top3Date: null,
            urgent: false,
            sort,
            doneAt: null,
          });
        });
        return created;
      });
      return { ...task, subtasks: base.list(eq(tasks.parentId, task.id), asc(tasks.sort)) };
    },

    update(id: string, input: TaskUpdate): Task & { next: Task | null } {
      const current = base.get(id);
      if (input.parentId !== undefined) assertParent(input.parentId, id);
      if (input.top3Date && input.top3Date !== current.top3Date)
        assertTopThreeRoom(input.top3Date, id);
      const { timeZone, today } = userTime(deps);
      return db.transaction(() => {
        const changes: Parameters<typeof base.update>[1] = { ...input };
        let completing = false;
        if (input.status === "done" && current.status !== "done") {
          completing = true;
          changes.doneAt = deps.now();
          // The series moves to the next copy; the finished one keeps no repeat rule.
          if (current.rrule) changes.rrule = null;
        } else if (input.status && input.status !== "done" && current.status === "done") {
          changes.doneAt = null;
        }
        const updated = base.update(id, changes);
        const applied = updated.updatedAt !== current.updatedAt;
        const next = completing && applied ? createNextOccurrence(current, timeZone, today) : null;
        return { ...updated, next };
      });
    },

    remove(id: string): Task {
      return db.transaction(() => {
        const removed = base.remove(id);
        const time = deps.now();
        db.update(tasks)
          .set({ deletedAt: time, updatedAt: time })
          .where(and(eq(tasks.parentId, id), isNull(tasks.deletedAt)))
          .run();
        return removed;
      });
    },

    /** One tap moves every overdue task to today, tomorrow or back to the inbox. */
    rescueOverdue(target: "today" | "tomorrow" | "inbox", date?: LocalDate): { moved: number } {
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
          const shift = doAt - task.doAt!;
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
      return { moved: overdue.length };
    },

    /**
     * "Does my day fit?" overflow: moves the lowest-priority tasks planned for `date`
     * (never the top three) to the next day until enough minutes are freed.
     */
    moveLowPriority(date: LocalDate, minutesToFree: number): { moved: Task[] } {
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
      let freed = 0;
      const time = deps.now();
      const nextDayStart = startOfLocalDay(addDays(date, 1), timeZone);
      db.transaction((tx) => {
        for (const task of candidates) {
          if (freed >= minutesToFree) break;
          const doAt = nextDayStart + (task.doAt! - from);
          const shift = doAt - task.doAt!;
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
        }
      });
      return { moved };
    },
  };
}
