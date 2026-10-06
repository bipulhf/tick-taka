import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { baseColumns, bool, isLocalDate, oneOf, rule } from "../columns";
import { goals } from "./money";

const PROJECT_STATUSES = ["active", "paused", "done"] as const;
const TASK_STATUSES = ["inbox", "open", "someday", "done"] as const;
const PRIORITIES = ["low", "normal", "high"] as const;
const WHEN_SLOTS = ["day", "evening"] as const;
const ENERGIES = ["high", "low"] as const;
const TIME_SOURCES = ["timer", "focus", "manual"] as const;
const HABIT_SCHEDULES = ["daily", "weekly", "n_per_week"] as const;

export const areas = sqliteTable("areas", {
  ...baseColumns(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const projects = sqliteTable(
  "projects",
  {
    ...baseColumns(),
    areaId: text("area_id")
      .notNull()
      .references(() => areas.id),
    name: text("name").notNull(),
    status: text("status", { enum: PROJECT_STATUSES }).notNull().default("active"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("projects_updated_at_idx").on(t.updatedAt),
    index("projects_area_idx").on(t.areaId),
    check("projects_status_check", oneOf("status", PROJECT_STATUSES)),
  ],
);

export const tasks = sqliteTable(
  "tasks",
  {
    ...baseColumns(),
    projectId: text("project_id").references(() => projects.id),
    areaId: text("area_id").references(() => areas.id),
    parentId: text("parent_id").references((): AnySQLiteColumn => tasks.id),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status", { enum: TASK_STATUSES }).notNull().default("inbox"),
    priority: text("priority", { enum: PRIORITIES }).notNull().default("normal"),
    /** When I plan to do it */
    doAt: integer("do_at"),
    hasTime: bool("has_time").notNull().default(false),
    whenSlot: text("when_slot", { enum: WHEN_SLOTS }).notNull().default("day"),
    /** When it must be done */
    deadlineAt: integer("deadline_at"),
    energy: text("energy", { enum: ENERGIES }),
    estimateMin: integer("estimate_min"),
    reminderAt: integer("reminder_at"),
    rrule: text("rrule"),
    top3Date: text("top3_date"),
    urgent: bool("urgent").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    doneAt: integer("done_at"),
    /** Set on "move ৳X to the jar" tasks that a savings goal creates each month */
    goalId: text("goal_id").references((): AnySQLiteColumn => goals.id),
    /** On a completed repeating task: the copy completing it created, so Undo can remove it */
    nextId: text("next_id").references((): AnySQLiteColumn => tasks.id),
  },
  (t) => [
    index("tasks_status_do_at_idx").on(t.status, t.doAt),
    index("tasks_parent_idx").on(t.parentId),
    index("tasks_top3_idx").on(t.top3Date),
    index("tasks_done_at_idx").on(t.doneAt),
    index("tasks_updated_at_idx").on(t.updatedAt),
    check("tasks_status_check", oneOf("status", TASK_STATUSES)),
    check("tasks_priority_check", oneOf("priority", PRIORITIES)),
    check("tasks_when_slot_check", oneOf("when_slot", WHEN_SLOTS)),
    check("tasks_energy_check", oneOf("energy", ENERGIES)),
    check("tasks_estimate_check", rule(`"estimate_min" >= 0`)),
    check("tasks_top3_date_check", isLocalDate("top3_date")),
    check("tasks_parent_self_check", rule(`"parent_id" <> "id"`)),
  ],
);

export const timeEntries = sqliteTable(
  "time_entries",
  {
    ...baseColumns(),
    taskId: text("task_id").references(() => tasks.id),
    areaId: text("area_id").references(() => areas.id),
    projectId: text("project_id").references(() => projects.id),
    startedAt: integer("started_at").notNull(),
    /** A running entry has no ended_at */
    endedAt: integer("ended_at"),
    source: text("source", { enum: TIME_SOURCES }).notNull().default("manual"),
    billable: bool("billable").notNull().default(false),
    note: text("note"),
  },
  (t) => [
    index("time_entries_updated_at_idx").on(t.updatedAt),
    index("time_entries_started_at_idx").on(t.startedAt),
    check("time_entries_source_check", oneOf("source", TIME_SOURCES)),
    check("time_entries_range_check", rule(`"ended_at" >= "started_at"`)),
  ],
);

export const habits = sqliteTable(
  "habits",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    color: text("color").notNull(),
    schedule: text("schedule", { enum: HABIT_SCHEDULES }).notNull().default("daily"),
    perWeek: integer("per_week"),
    targetCount: integer("target_count").notNull().default(1),
    /** Local HH:MM for the habit nudge */
    remindAt: text("remind_at"),
    sort: integer("sort").notNull().default(0),
    archivedAt: integer("archived_at"),
  },
  () => [
    check("habits_schedule_check", oneOf("schedule", HABIT_SCHEDULES)),
    check("habits_per_week_check", rule(`"per_week" BETWEEN 1 AND 7`)),
    check("habits_target_check", rule(`"target_count" >= 1`)),
  ],
);

export const habitLogs = sqliteTable(
  "habit_logs",
  {
    ...baseColumns(),
    habitId: text("habit_id")
      .notNull()
      .references(() => habits.id),
    /** Local date YYYY-MM-DD */
    date: text("date").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    index("habit_logs_updated_at_idx").on(t.updatedAt),
    uniqueIndex("habit_logs_habit_date_uq").on(t.habitId, t.date),
    check("habit_logs_date_check", isLocalDate("date")),
    check("habit_logs_count_check", rule(`"count" >= 0`)),
  ],
);

export const routines = sqliteTable("routines", {
  ...baseColumns(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const routineSteps = sqliteTable(
  "routine_steps",
  {
    ...baseColumns(),
    routineId: text("routine_id")
      .notNull()
      .references(() => routines.id),
    title: text("title").notNull(),
    minutes: integer("minutes"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("routine_steps_updated_at_idx").on(t.updatedAt),
    index("routine_steps_routine_idx").on(t.routineId),
    check("routine_steps_minutes_check", rule(`"minutes" >= 0`)),
  ],
);
