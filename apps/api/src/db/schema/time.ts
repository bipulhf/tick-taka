import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { baseColumns, bool } from "../columns";

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
    status: text("status", { enum: ["active", "paused", "done"] })
      .notNull()
      .default("active"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("projects_area_idx").on(t.areaId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    ...baseColumns(),
    projectId: text("project_id").references(() => projects.id),
    areaId: text("area_id").references(() => areas.id),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    notes: text("notes"),
    status: text("status", { enum: ["inbox", "open", "someday", "done"] })
      .notNull()
      .default("inbox"),
    priority: text("priority", { enum: ["low", "normal", "high"] })
      .notNull()
      .default("normal"),
    /** When I plan to do it */
    doAt: integer("do_at"),
    hasTime: bool("has_time").notNull().default(false),
    whenSlot: text("when_slot", { enum: ["day", "evening"] })
      .notNull()
      .default("day"),
    /** When it must be done */
    deadlineAt: integer("deadline_at"),
    energy: text("energy", { enum: ["high", "low"] }),
    estimateMin: integer("estimate_min"),
    reminderAt: integer("reminder_at"),
    rrule: text("rrule"),
    top3Date: text("top3_date"),
    urgent: bool("urgent").notNull().default(false),
    sort: integer("sort").notNull().default(0),
    doneAt: integer("done_at"),
    /** Set on "move ৳X to the jar" tasks that a savings goal creates each month */
    goalId: text("goal_id"),
  },
  (t) => [
    index("tasks_status_do_at_idx").on(t.status, t.doAt),
    index("tasks_parent_idx").on(t.parentId),
    index("tasks_top3_idx").on(t.top3Date),
    index("tasks_done_at_idx").on(t.doneAt),
    index("tasks_updated_at_idx").on(t.updatedAt),
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
    source: text("source", { enum: ["timer", "focus", "manual"] })
      .notNull()
      .default("manual"),
    billable: bool("billable").notNull().default(false),
    note: text("note"),
  },
  (t) => [index("time_entries_started_at_idx").on(t.startedAt)],
);

export const habits = sqliteTable("habits", {
  ...baseColumns(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  schedule: text("schedule", { enum: ["daily", "weekly", "n_per_week"] })
    .notNull()
    .default("daily"),
  perWeek: integer("per_week"),
  targetCount: integer("target_count").notNull().default(1),
  /** Local HH:MM for the habit nudge */
  remindAt: text("remind_at"),
  sort: integer("sort").notNull().default(0),
  archivedAt: integer("archived_at"),
});

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
  (t) => [uniqueIndex("habit_logs_habit_date_uq").on(t.habitId, t.date)],
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
  (t) => [index("routine_steps_routine_idx").on(t.routineId)],
);
