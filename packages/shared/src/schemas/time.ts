import { z } from "zod";
import {
  clockSchema,
  colorSchema,
  editTimeShape,
  emojiSchema,
  epochMsSchema,
  idSchema,
  localDateSchema,
  nameSchema,
  noteSchema,
  queryBoolSchema,
  queryEpochSchema,
  rruleSchema,
  tapTimeSchema,
} from "./common";

export const PROJECT_STATUSES = ["active", "paused", "done"] as const;
export const TASK_STATUSES = ["inbox", "open", "someday", "done"] as const;
export const TASK_PRIORITIES = ["low", "normal", "high"] as const;
export const WHEN_SLOTS = ["day", "evening"] as const;
export const ENERGY_LEVELS = ["high", "low"] as const;
export const TIME_SOURCES = ["timer", "focus", "manual"] as const;
export const HABIT_SCHEDULES = ["daily", "weekly", "n_per_week"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type HabitSchedule = (typeof HABIT_SCHEDULES)[number];

// Areas -----------------------------------------------------------------------
export const areaCreateSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  emoji: emojiSchema,
  color: colorSchema,
  sort: z.number().int().optional(),
});
export const areaUpdateSchema = areaCreateSchema.omit({ id: true }).partial().extend(editTimeShape);
export type AreaCreate = z.infer<typeof areaCreateSchema>;

// Projects --------------------------------------------------------------------
export const projectCreateSchema = z.object({
  id: idSchema.optional(),
  areaId: idSchema,
  name: nameSchema,
  status: z.enum(PROJECT_STATUSES).default("active"),
  sort: z.number().int().optional(),
});
export const projectUpdateSchema = projectCreateSchema
  .omit({ id: true })
  .partial()
  .extend(editTimeShape);
export const projectListQuerySchema = z.object({
  areaId: idSchema.optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
});

// Tasks -----------------------------------------------------------------------
const taskFields = {
  title: z.string().trim().min(1).max(300),
  notes: noteSchema.nullable(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(TASK_PRIORITIES),
  projectId: idSchema.nullable(),
  areaId: idSchema.nullable(),
  parentId: idSchema.nullable(),
  doAt: epochMsSchema.nullable(),
  hasTime: z.boolean(),
  whenSlot: z.enum(WHEN_SLOTS),
  deadlineAt: epochMsSchema.nullable(),
  energy: z.enum(ENERGY_LEVELS).nullable(),
  estimateMin: z
    .number()
    .int()
    .min(1)
    .max(24 * 60)
    .nullable(),
  reminderAt: epochMsSchema.nullable(),
  rrule: rruleSchema.nullable(),
  top3Date: localDateSchema.nullable(),
  /** Urgent flag for the Eisenhower grid; importance comes from priority. */
  urgent: z.boolean(),
  sort: z.number().int(),
};

export const taskCreateSchema = z.object({
  id: idSchema.optional(),
  title: taskFields.title,
  notes: taskFields.notes.optional(),
  status: taskFields.status.default("inbox"),
  priority: taskFields.priority.default("normal"),
  projectId: taskFields.projectId.optional(),
  areaId: taskFields.areaId.optional(),
  parentId: taskFields.parentId.optional(),
  doAt: taskFields.doAt.optional(),
  hasTime: taskFields.hasTime.default(false),
  whenSlot: taskFields.whenSlot.default("day"),
  deadlineAt: taskFields.deadlineAt.optional(),
  energy: taskFields.energy.optional(),
  estimateMin: taskFields.estimateMin.optional(),
  reminderAt: taskFields.reminderAt.optional(),
  rrule: taskFields.rrule.optional(),
  top3Date: taskFields.top3Date.optional(),
  urgent: taskFields.urgent.default(false),
  sort: taskFields.sort.optional(),
  subtasks: z.array(z.string().trim().min(1).max(300)).max(20).optional(),
});
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = z.object({ ...taskFields, updatedAt: epochMsSchema }).partial();
export type TaskUpdate = z.infer<typeof taskUpdateSchema>;

export const taskListQuerySchema = z.object({
  status: z
    .string()
    .transform((value) => value.split(",").filter(Boolean))
    .pipe(z.array(z.enum(TASK_STATUSES)))
    .optional(),
  areaId: idSchema.optional(),
  projectId: idSchema.optional(),
  parentId: idSchema.optional(),
  from: queryEpochSchema.optional(),
  to: queryEpochSchema.optional(),
  /** Tasks whose reminder rings in [reminderFrom, reminderTo), dated or not. */
  reminderFrom: queryEpochSchema.optional(),
  reminderTo: queryEpochSchema.optional(),
  doneFrom: queryEpochSchema.optional(),
  doneTo: queryEpochSchema.optional(),
  top3Date: localDateSchema.optional(),
  q: z.string().max(200).optional(),
  includeSubtasks: queryBoolSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;

export const rescueOverdueSchema = z.object({
  target: z.enum(["today", "tomorrow", "inbox"]),
  date: localDateSchema.optional(),
});

export const moveLowPrioritySchema = z.object({
  date: localDateSchema,
  minutesToFree: z.number().int().positive(),
});

// Routines ----------------------------------------------------------------------
export const routineStepSchema = z.object({
  id: idSchema.optional(),
  title: z.string().trim().min(1).max(200),
  minutes: z.number().int().min(1).max(240).nullable().optional(),
  sort: z.number().int().optional(),
});
export const routineCreateSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  emoji: emojiSchema,
  sort: z.number().int().optional(),
  steps: z.array(routineStepSchema).max(50).optional(),
});
export const routineUpdateSchema = routineCreateSchema
  .omit({ id: true })
  .partial()
  .extend(editTimeShape);

// Time entries --------------------------------------------------------------
export const timerStartSchema = z.object({
  id: idSchema.optional(),
  taskId: idSchema.nullable().optional(),
  areaId: idSchema.nullable().optional(),
  projectId: idSchema.nullable().optional(),
  source: z.enum(["timer", "focus"]).default("timer"),
  billable: z.boolean().default(false),
  note: noteSchema.nullable().optional(),
  startedAt: epochMsSchema.optional(),
  /** When Start was tapped on the phone; wins over startedAt so an offline start keeps its time. */
  at: tapTimeSchema.optional(),
});
export const timerStopSchema = z.object({
  /** The entry to stop; a replay for an entry that already stopped returns it. */
  id: idSchema.optional(),
  endedAt: epochMsSchema.optional(),
  /** When Stop was tapped on the phone; wins over endedAt. */
  at: tapTimeSchema.optional(),
});

export const timeEntryCreateSchema = z
  .object({
    id: idSchema.optional(),
    taskId: idSchema.nullable().optional(),
    areaId: idSchema.nullable().optional(),
    projectId: idSchema.nullable().optional(),
    startedAt: epochMsSchema,
    endedAt: epochMsSchema,
    source: z.enum(TIME_SOURCES).default("manual"),
    billable: z.boolean().default(false),
    note: noteSchema.nullable().optional(),
  })
  .refine((v) => v.endedAt > v.startedAt, {
    message: "End must be after start",
    path: ["endedAt"],
  });

export const timeEntryUpdateSchema = z
  .object({
    taskId: idSchema.nullable(),
    areaId: idSchema.nullable(),
    projectId: idSchema.nullable(),
    startedAt: epochMsSchema,
    endedAt: epochMsSchema.nullable(),
    billable: z.boolean(),
    note: noteSchema.nullable(),
    updatedAt: epochMsSchema,
  })
  .partial();

export const timeEntryListQuerySchema = z.object({
  from: queryEpochSchema.optional(),
  to: queryEpochSchema.optional(),
  areaId: idSchema.optional(),
  taskId: idSchema.optional(),
});

// Habits ----------------------------------------------------------------------
export const habitCreateSchema = z
  .object({
    id: idSchema.optional(),
    name: nameSchema,
    emoji: emojiSchema,
    color: colorSchema.default("#A57BFF"),
    schedule: z.enum(HABIT_SCHEDULES).default("daily"),
    perWeek: z.number().int().min(1).max(7).nullable().optional(),
    targetCount: z.number().int().min(1).max(100).default(1),
    remindAt: clockSchema.nullable().optional(),
    sort: z.number().int().optional(),
  })
  .refine((v) => v.schedule !== "n_per_week" || (v.perWeek ?? 0) >= 1, {
    message: "Pick how many times a week",
    path: ["perWeek"],
  });
export const habitUpdateSchema = z
  .object({
    name: nameSchema,
    emoji: emojiSchema,
    color: colorSchema,
    schedule: z.enum(HABIT_SCHEDULES),
    perWeek: z.number().int().min(1).max(7).nullable(),
    targetCount: z.number().int().min(1).max(100),
    remindAt: clockSchema.nullable(),
    archived: z.boolean(),
    sort: z.number().int(),
  })
  .partial()
  .extend(editTimeShape);
export const habitLogPutSchema = z.object({ count: z.number().int().min(0).max(1000) });
