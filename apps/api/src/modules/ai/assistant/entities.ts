/** Everything the assistant can create, change, delete or look up, mapped onto the REST routes. */
export interface EntityDef {
  path: string;
  /** Field guide for the model; amounts in taka and dates as local text are converted on the server. */
  fields: string;
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
    fields: `title, notes, status (inbox|open|someday|done; open = planned, done = completed), priority (low|normal|high), area (name), project (name), parent (task id, for subtasks), doAt (${DATE}; the day to do it, with a time when given), whenSlot (day|evening), deadlineAt (${DATE}), estimateMin, reminderAt (${DATE}), rrule (iCal RRULE such as FREQ=WEEKLY;BYDAY=MO, or null), top3Date (YYYY-MM-DD, pins it to that day's top three), urgent (boolean), subtasks (array of titles, create only)`,
    listQuery: (f) =>
      `?limit=60${f.status ? `&status=${encodeURIComponent(f.status)}` : "&status=inbox,open,someday"}${f.from !== null ? `&from=${f.from}` : ""}${f.to !== null ? `&to=${f.to}` : ""}${f.query ? `&q=${encodeURIComponent(f.query)}` : ""}`,
  },
  project: {
    path: "/projects",
    canGet: true,
    fields: "name, area (name, required on create), status (active|paused|done)",
    listQuery: (f) => (f.status ? `?status=${encodeURIComponent(f.status)}` : ""),
  },
  area: { path: "/areas", canGet: true, fields: "name, emoji, color (#RRGGBB)" },
  habit: {
    path: "/habits",
    canGet: false,
    fields:
      "name, emoji, schedule (daily|weekly|n_per_week), perWeek (1-7 for n_per_week), targetCount (times per day), remindAt (HH:MM), archived (boolean)",
  },
  transaction: {
    path: "/transactions",
    canGet: true,
    fields: `type (expense|income|transfer), amount (taka), account (name), toAccount (name, transfers), fee (taka), category (name), area (name), event (name), note, occurredAt (${DATE}, default now)`,
    listQuery: (f) =>
      `?limit=40${f.from !== null ? `&from=${f.from}` : ""}${f.to !== null ? `&to=${f.to}` : ""}${f.query ? `&q=${encodeURIComponent(f.query)}` : ""}`,
  },
  account: {
    path: "/accounts",
    canGet: true,
    fields:
      "name, type (cash|bank|mobile_wallet|card|savings), currency (default BDT), opening (opening balance in taka), icon (emoji), archived (boolean)",
  },
  category: {
    path: "/categories",
    canGet: false,
    fields:
      "name, emoji, kind (expense|income, create only), budgetType (fixed|non_monthly|flexible)",
  },
  bill: {
    path: "/recurring",
    canGet: true,
    fields: `kind (bill|income), name, amount (taka), account (name), category (name), rrule (iCal RRULE such as FREQ=MONTHLY;BYMONTHDAY=5), nextDueAt (${DATE}), remindDays, active (boolean)`,
  },
  goal: {
    path: "/goals",
    canGet: true,
    fields: "name, emoji, target (taka), deadline (YYYY-MM-DD), account (name), done (boolean)",
  },
  debt: {
    path: "/debts",
    canGet: true,
    fields: `person, direction (owed_to_me|i_owe, create only), principal (taka, create only), dueAt (${DATE}), note, account (name, create only: where the money moved), closed (boolean)`,
  },
  event: {
    path: "/events",
    canGet: true,
    fields: "name, emoji, budget (taka), startsOn (YYYY-MM-DD), endsOn (YYYY-MM-DD)",
  },
  shopping_item: {
    path: "/shopping",
    canGet: false,
    fields: "title, listName (default Bazar), est (estimated price in taka), checked (boolean)",
  },
  routine: {
    path: "/routines",
    canGet: true,
    fields: "name, emoji, steps (array of { title, minutes })",
  },
  time_entry: {
    path: "/time-entries",
    canGet: false,
    fields: `startedAt (${DATE}), endedAt (${DATE}), task (task id), area (name), project (name), billable (boolean), note`,
    listQuery: (f) =>
      `?${f.from !== null ? `from=${f.from}&` : ""}${f.to !== null ? `to=${f.to}` : ""}`,
  },
} satisfies Record<string, EntityDef>;

export type EntityName = keyof typeof ENTITIES;
export const ENTITY_NAMES = Object.keys(ENTITIES) as EntityName[];

export function describeEntities(): string {
  return ENTITY_NAMES.map((name) => `- ${name}: ${ENTITIES[name].fields}`).join("\n");
}
