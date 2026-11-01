import type { AssistantRecordKind } from "@tick-taka/shared/schemas/ai";

/** Everything the assistant can create, change, delete or look up, mapped onto the REST routes. */
export interface EntityDef {
  path: string;
  /**
   * Field guide for the model; amounts in taka and dates as local text are converted
   * on the server. It starts with what the create route requires (after `defaults`),
   * so a create the model builds from it works the first time.
   */
  fields: string;
  /** Filled in on create when the model leaves them out: what the app's own forms prefill. */
  defaults?: Record<string, unknown>;
  /** Query string for the list route, from the find tool's filters. */
  listQuery?: (filters: {
    query: string | null;
    from: number | null;
    to: number | null;
    status: string | null;
  }) => string;
  /** GET /:id exists, so updates can be undone. */
  canGet: boolean;
}

const DATE = `local "YYYY-MM-DD" or "YYYY-MM-DD HH:mm"`;

export const ENTITIES = {
  task: {
    path: "/tasks",
    canGet: true,
    fields: `required: title (at most 300 characters). Optional: notes (at most 2000), status (inbox|open|someday|done; open = planned, done = completed), priority (low|normal|high), area (name), project (name), parent (task id, for subtasks), doAt (${DATE}; the day to do it, with a time when given), whenSlot (day|evening), deadlineAt (${DATE}), estimateMin, reminderAt (${DATE}), rrule (iCal RRULE such as FREQ=WEEKLY;BYDAY=MO, or null), top3Date (YYYY-MM-DD, pins it to that day's top three), subtasks (array of titles, create only)`,
    listQuery: (f) =>
      `?limit=60${f.status ? `&status=${encodeURIComponent(f.status)}` : "&status=inbox,open,someday"}${f.from !== null ? `&from=${f.from}` : ""}${f.to !== null ? `&to=${f.to}` : ""}${f.query ? `&q=${encodeURIComponent(f.query)}` : ""}`,
  },
  project: {
    path: "/projects",
    canGet: true,
    fields: "required: name, area (name). Optional: status (active|paused|done)",
    listQuery: (f) => (f.status ? `?status=${encodeURIComponent(f.status)}` : ""),
  },
  area: {
    path: "/areas",
    canGet: true,
    fields: "required: name. Optional: emoji (one emoji), color (#RRGGBB)",
    defaults: { emoji: "⭐", color: "#5B8CFF" },
  },
  habit: {
    path: "/habits",
    canGet: false,
    fields:
      'required: name. Optional: emoji (one emoji), schedule (daily|weekly|n_per_week, default daily), perWeek (1-7, required with n_per_week), targetCount (times per day, 1-100, default 1: "8 times a day" is daily with targetCount 8), remindAt (HH:MM), archived (boolean, update only)',
    defaults: { emoji: "✅" },
  },
  transaction: {
    path: "/transactions",
    canGet: true,
    fields: `required: type (expense|income|transfer), amount (taka). Optional: account (name; expenses and income default to the default account), toAccount (name, required for transfers), fee (taka), category (name), area (name), event (name), note, occurredAt (${DATE}, default now)`,
    listQuery: (f) =>
      `?limit=40${f.from !== null ? `&from=${f.from}` : ""}${f.to !== null ? `&to=${f.to}` : ""}${f.query ? `&q=${encodeURIComponent(f.query)}` : ""}`,
  },
  account: {
    path: "/accounts",
    canGet: true,
    fields:
      "required: name, type (cash|bank|mobile_wallet|card|savings). Optional: opening (opening balance in taka, default 0), currency (default BDT), icon (emoji), archived (boolean, update only)",
  },
  category: {
    path: "/categories",
    canGet: false,
    fields:
      "required: name. Optional: kind (expense|income, default expense, create only), emoji (one emoji), budgetType (fixed|non_monthly|flexible, default flexible)",
    defaults: { emoji: "🏷️" },
  },
  bill: {
    path: "/recurring",
    canGet: true,
    fields: `required: name, amount (taka, more than 0), rrule (how often, an iCal RRULE: FREQ=MONTHLY;BYMONTHDAY=5 for monthly on the 5th, FREQ=WEEKLY;BYDAY=MO, FREQ=YEARLY), nextDueAt (the next due date, YYYY-MM-DD). Optional: kind (bill|income, default bill), account (name), category (name), remindDays (0-30, default 2), active (boolean, update only)`,
    defaults: { kind: "bill" },
  },
  goal: {
    path: "/goals",
    canGet: true,
    fields:
      "required: name, target (taka, more than 0). Optional: emoji, deadline (YYYY-MM-DD), account (name), done (boolean, update only)",
  },
  debt: {
    path: "/debts",
    canGet: true,
    fields: `required: person, direction (owed_to_me|i_owe, create only), principal (taka, more than 0, create only). Optional: dueAt (${DATE}), note, account (name, create only: where the money moved), closed (boolean, update only)`,
  },
  event: {
    path: "/events",
    canGet: true,
    fields:
      "required: name, startsOn (YYYY-MM-DD), endsOn (YYYY-MM-DD, on or after startsOn). Optional: emoji, budget (taka). Only a trip or occasion with a money budget across days, never an appointment (that is a task)",
  },
  routine: {
    path: "/routines",
    canGet: true,
    fields:
      "required: name. Optional: emoji (one emoji), steps (array of { title, minutes }, at most 50)",
    defaults: { emoji: "✨" },
  },
  time_entry: {
    path: "/time-entries",
    canGet: false,
    fields: `required: startedAt (${DATE}), endedAt (${DATE}, after startedAt). Optional: task (task id), area (name), project (name), billable (boolean), note`,
    listQuery: (f) =>
      `?${f.from !== null ? `from=${f.from}&` : ""}${f.to !== null ? `to=${f.to}` : ""}`,
  },
} satisfies Record<string, EntityDef>;

export type EntityName = keyof typeof ENTITIES;
export const ENTITY_NAMES = Object.keys(ENTITIES) as EntityName[];

export function describeEntities(): string {
  return ENTITY_NAMES.map((name) => `- ${name}: ${ENTITIES[name].fields}`).join("\n");
}

/** The entity behind each record kind the apps name (`screen.record`, cards). */
export const KIND_ENTITY: Record<AssistantRecordKind, EntityName> = {
  task: "task",
  transaction: "transaction",
  habit: "habit",
  goal: "goal",
  debt: "debt",
  account: "account",
  event: "event",
  project: "project",
  recurring: "bill",
  time_entry: "time_entry",
  routine: "routine",
};

/** The record kind the apps know an entity by; areas and categories have none. */
export const ENTITY_KIND = Object.fromEntries(
  Object.entries(KIND_ENTITY).map(([kind, entity]) => [entity, kind]),
) as Partial<Record<EntityName, AssistantRecordKind>>;
