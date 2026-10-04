import {
  addDays,
  isLocalDate,
  isLocalMonth,
  type LocalDate,
  startOfLocalDay,
} from "@tick-taka/shared/dates";
import { newId } from "@tick-taka/shared/ids";
import type { AiToolDefinition } from "../../../ai/client";
import type { Caller } from "./dispatch";
import { describeEntities, ENTITIES, ENTITY_NAMES, type EntityName } from "./entities";
import { createFieldConverter, FieldError, project } from "./fields";

/** How the phone can reverse one change: the request to send, with a fresh edit time for PATCH. */
export interface Undo {
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}

export interface Action {
  summary: string;
  undo?: Undo;
}

export const ACTIONS = [
  "log_habit",
  "pay_bill",
  "contribute_goal",
  "repay_debt",
  "check_balance",
  "start_timer",
  "stop_timer",
  "set_budget",
  "checkout_shopping",
  "update_settings",
] as const;
type ActionName = (typeof ACTIONS)[number];

const nullableString = { type: ["string", "null"] };
const entityParam = { type: "string", enum: ENTITY_NAMES };
const fieldsParam = {
  type: "string",
  description: 'JSON object of fields, for example {"title":"Call bank","doAt":"2026-10-05 17:00"}',
};

export const WRITE_TOOLS: AiToolDefinition[] = [
  {
    name: "find",
    description:
      "Look up records to get their ids and details. Filters are optional; dates are local YYYY-MM-DD (tasks filter by do date, transactions and time entries by when they happened).",
    parameters: {
      type: "object",
      properties: {
        entity: entityParam,
        query: { ...nullableString, description: "Text to match in the title, name or note" },
        status: {
          ...nullableString,
          description: "Tasks: comma list of inbox,open,someday,done. Projects: active|paused|done",
        },
        from: nullableString,
        to: nullableString,
      },
      required: ["entity", "query", "status", "from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "create",
    description: `Create one record. Fields per entity (all optional unless the app needs them):\n${describeEntities()}`,
    parameters: {
      type: "object",
      properties: { entity: entityParam, fields: fieldsParam },
      required: ["entity", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "update",
    description:
      "Change fields of one record found with find. Only send the fields that change. Completing a task is status done.",
    parameters: {
      type: "object",
      properties: { entity: entityParam, id: { type: "string" }, fields: fieldsParam },
      required: ["entity", "id", "fields"],
      additionalProperties: false,
    },
  },
  {
    name: "delete",
    description: "Delete one record found with find. The user can undo it.",
    parameters: {
      type: "object",
      properties: { entity: entityParam, id: { type: "string" } },
      required: ["entity", "id"],
      additionalProperties: false,
    },
  },
  {
    name: "act",
    description: [
      "Special actions. id is the record the action is about, or null.",
      "log_habit: id = habit; fields {date?: YYYY-MM-DD, count?: number} (count defaults to one more than today).",
      "pay_bill: id = bill; fields {account?, amount? (taka), skip?: boolean}.",
      "contribute_goal: id = goal; fields {amount, fromAccount}.",
      "repay_debt: id = debt; fields {amount, account}.",
      "check_balance: id = account; fields {actual} (the real balance in taka; the app adds an adjustment).",
      "start_timer: id null; fields {task?: task id, area?, project?, note?}. stop_timer: id null; fields {}.",
      "set_budget: id null; fields {month: YYYY-MM, category, limit} (taka; 0 removes it).",
      "checkout_shopping: id null; fields {listName, account, category?, amount?}.",
      'update_settings: id null; fields = settings to change, e.g. {dailyTaskGoal: 5, theme: "dark", vacationMode: true}.',
    ].join("\n"),
    parameters: {
      type: "object",
      properties: {
        action: { type: "string", enum: ACTIONS },
        id: nullableString,
        fields: fieldsParam,
      },
      required: ["action", "id", "fields"],
      additionalProperties: false,
    },
  },
];

const label = (record: Record<string, unknown> | null | undefined, entity: string): string => {
  if (!record) return entity.replace("_", " ");
  const text = record.title ?? record.name ?? record.note ?? record.person;
  return typeof text === "string" && text ? `“${text.slice(0, 60)}”` : entity.replace("_", " ");
};

const listOf = (data: unknown): Record<string, unknown>[] =>
  (Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown })?.items)
      ? (data as { items: unknown[] }).items
      : []) as Record<string, unknown>[];

function parseFields(raw: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw || "{}");
  } catch {
    throw new FieldError("fields must be a JSON object");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
    throw new FieldError("fields must be a JSON object");
  return parsed as Record<string, unknown>;
}

function entityOf(name: unknown): EntityName {
  if (typeof name !== "string" || !(name in ENTITIES))
    throw new FieldError(`Unknown entity ${String(name)}`);
  return name as EntityName;
}

/**
 * Runs the write tools for one assistant turn. Every change goes through the
 * normal REST routes and is recorded with a way to undo it.
 */
export function createToolRunner(
  caller: Caller,
  options: { timeZone: string; now: number; today: LocalDate },
) {
  const { timeZone, now, today } = options;
  const convert = createFieldConverter(caller, timeZone, now);
  const actions: Action[] = [];
  const fail = (error: string | undefined) => ({ error: error ?? "That didn't work" });

  const dayStart = (value: unknown) =>
    typeof value === "string" && isLocalDate(value) ? startOfLocalDay(value, timeZone) : null;

  async function find(args: Record<string, unknown>) {
    const entity = entityOf(args.entity);
    const def = ENTITIES[entity];
    const query = typeof args.query === "string" && args.query.trim() ? args.query.trim() : null;
    const from = dayStart(args.from);
    const to =
      typeof args.to === "string" && isLocalDate(args.to)
        ? startOfLocalDay(addDays(args.to, 1), timeZone)
        : null;
    const status = typeof args.status === "string" ? args.status : null;
    const search = "listQuery" in def ? def.listQuery({ query, from, to, status }) : "";
    const result = await caller.call("GET", `${def.path}${search}`);
    if (!result.ok) return fail(result.error);
    let items = listOf(result.data);
    if (query && !("listQuery" in def && search.includes("q="))) {
      const needle = query.toLowerCase();
      items = items.filter((item) =>
        ["title", "name", "note", "person", "listName"].some(
          (key) =>
            typeof item[key] === "string" && (item[key] as string).toLowerCase().includes(needle),
        ),
      );
    }
    if (entity === "debt") {
      // Names in debts stay on the server unless the user typed them.
      items = items.map((item, index) =>
        query && String(item.person).toLowerCase().includes(query.toLowerCase())
          ? item
          : { ...item, person: `Person ${index + 1}` },
      );
    }
    return { count: items.length, items: project(items.slice(0, 25), timeZone) };
  }

  async function create(args: Record<string, unknown>) {
    const entity = entityOf(args.entity);
    const def = ENTITIES[entity];
    const fields = await convert(parseFields(String(args.fields)));
    if (entity === "task" && fields.doAt != null && fields.status === undefined)
      fields.status = "open";
    if (entity === "transaction" && fields.occurredAt === undefined) fields.occurredAt = now;
    if (entity === "time_entry" && fields.source === undefined) fields.source = "manual";
    const id = newId(now);
    const result = await caller.call("POST", def.path, { id, ...fields });
    if (!result.ok) return fail(result.error);
    const record = result.data as Record<string, unknown>;
    const recordId = typeof record?.id === "string" ? record.id : id;
    actions.push({
      summary: `Added ${entity.replace("_", " ")} ${label(record, "")}`.trim(),
      undo: { method: "DELETE", path: `${def.path}/${recordId}` },
    });
    return { ok: true, id: recordId, record: project(record, timeZone) };
  }

  async function update(args: Record<string, unknown>) {
    const entity = entityOf(args.entity);
    const def = ENTITIES[entity];
    const id = String(args.id);
    const fields = await convert(parseFields(String(args.fields)));
    const before = def.canGet ? await caller.call("GET", `${def.path}/${id}`) : null;
    const result = await caller.call("PATCH", `${def.path}/${id}`, { ...fields, updatedAt: now });
    if (!result.ok) return fail(result.error);
    const record = result.data as Record<string, unknown>;
    const previous = before?.ok ? (before.data as Record<string, unknown>) : null;
    const undoBody = previous
      ? Object.fromEntries(
          Object.keys(fields)
            .filter((key) => key in previous)
            .map((key) => [key, previous[key]]),
        )
      : null;
    const done = entity === "task" && fields.status === "done";
    actions.push({
      summary:
        `${done ? "Completed" : "Updated"} ${entity.replace("_", " ")} ${label(record ?? previous, "")}`.trim(),
      undo:
        undoBody && Object.keys(undoBody).length
          ? { method: "PATCH", path: `${def.path}/${id}`, body: undoBody }
          : undefined,
    });
    return { ok: true, record: project(record, timeZone) };
  }

  async function remove(args: Record<string, unknown>) {
    const entity = entityOf(args.entity);
    const def = ENTITIES[entity];
    const id = String(args.id);
    const before = def.canGet ? await caller.call("GET", `${def.path}/${id}`) : null;
    const result = await caller.call("DELETE", `${def.path}/${id}`);
    if (!result.ok) return fail(result.error);
    const record = (before?.ok ? before.data : result.data) as Record<string, unknown> | null;
    actions.push({
      summary: `Deleted ${entity.replace("_", " ")} ${label(record, "")}`.trim(),
      undo: { method: "POST", path: `${def.path}/${id}/restore` },
    });
    return { ok: true };
  }

  async function act(args: Record<string, unknown>) {
    const action = args.action as ActionName;
    const id = typeof args.id === "string" ? args.id : null;
    const raw = parseFields(String(args.fields));
    const needId = () => {
      if (!id) throw new FieldError(`${action} needs the id of the record`);
      return id;
    };
    switch (action) {
      case "log_habit": {
        const habitId = needId();
        const date = typeof raw.date === "string" && isLocalDate(raw.date) ? raw.date : today;
        const habits = listOf((await caller.call("GET", `/habits?date=${date}`)).data);
        const habit = habits.find((h) => h.id === habitId);
        const previous = typeof habit?.todayCount === "number" ? habit.todayCount : 0;
        const count = typeof raw.count === "number" ? raw.count : previous + 1;
        const result = await caller.call("PUT", `/habits/${habitId}/logs/${date}`, { count });
        if (!result.ok) return fail(result.error);
        actions.push({
          summary: `Logged ${label(habit, "habit")} (${count}${typeof habit?.targetCount === "number" ? `/${habit.targetCount}` : ""})`,
          undo: {
            method: "PUT",
            path: `/habits/${habitId}/logs/${date}`,
            body: { count: previous },
          },
        });
        return { ok: true, count };
      }
      case "pay_bill": {
        const body = await convert(raw);
        const result = await caller.call("POST", `/recurring/${needId()}/pay`, {
          transactionId: newId(now),
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({
          summary: raw.skip
            ? "Skipped this bill"
            : `Paid ${label(result.data as Record<string, unknown>, "bill")}`,
        });
        return { ok: true };
      }
      case "contribute_goal": {
        const body = await convert(raw);
        const result = await caller.call("POST", `/goals/${needId()}/contribute`, {
          id: newId(now),
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({
          summary: `Added to goal ${label(result.data as Record<string, unknown>, "")}`.trim(),
        });
        return { ok: true };
      }
      case "repay_debt": {
        const body = await convert(raw);
        const result = await caller.call("POST", `/debts/${needId()}/repay`, {
          id: newId(now),
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({ summary: "Recorded a debt repayment" });
        return { ok: true };
      }
      case "check_balance": {
        const body = await convert(raw);
        const result = await caller.call("POST", `/accounts/${needId()}/balance-check`, {
          id: newId(now),
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({ summary: "Matched the account balance" });
        return { ok: true, result: project(result.data, timeZone) };
      }
      case "start_timer": {
        const body = await convert(raw);
        const result = await caller.call("POST", "/timer/start", {
          id: newId(now),
          source: "timer",
          startedAt: now,
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({ summary: "Started the timer" });
        return { ok: true };
      }
      case "stop_timer": {
        const result = await caller.call("POST", "/timer/stop", { endedAt: now });
        if (!result.ok) return fail(result.error);
        actions.push({ summary: "Stopped the timer" });
        return { ok: true };
      }
      case "set_budget": {
        const month =
          typeof raw.month === "string" && isLocalMonth(raw.month) ? raw.month : today.slice(0, 7);
        const { categoryId, limitMinor } = await convert({
          category: raw.category,
          limit: raw.limit,
        });
        const current = (await caller.call("GET", `/budgets?month=${month}`)).data as {
          lines?: {
            categoryId: string;
            limitMinor: number;
            rollover?: boolean;
            hasBudget?: boolean;
          }[];
        } | null;
        const kept = (current?.lines ?? [])
          .filter((line) => line.hasBudget && line.categoryId !== categoryId)
          .map((line) => ({
            categoryId: line.categoryId,
            limitMinor: line.limitMinor,
            rollover: line.rollover ?? false,
          }));
        const budgets =
          Number(limitMinor) > 0 ? [...kept, { categoryId, limitMinor, rollover: false }] : kept;
        const result = await caller.call("PUT", "/budgets", { month, budgets });
        if (!result.ok) return fail(result.error);
        actions.push({
          summary: Number(limitMinor) > 0 ? `Set a ${month} budget` : `Removed a ${month} budget`,
        });
        return { ok: true };
      }
      case "checkout_shopping": {
        const body = await convert(raw);
        const result = await caller.call("POST", "/shopping/checkout", {
          transactionId: newId(now),
          ...body,
        });
        if (!result.ok) return fail(result.error);
        actions.push({ summary: "Checked out the shopping list" });
        return { ok: true };
      }
      case "update_settings": {
        const result = await caller.call("PATCH", "/settings", raw);
        if (!result.ok) return fail(result.error);
        actions.push({ summary: `Changed settings: ${Object.keys(raw).join(", ")}` });
        return { ok: true };
      }
      default:
        throw new FieldError(`Unknown action ${String(action)}`);
    }
  }

  return {
    actions,
    async run(name: string, rawArgs: string): Promise<unknown> {
      try {
        const args = JSON.parse(rawArgs || "{}") as Record<string, unknown>;
        switch (name) {
          case "find":
            return await find(args);
          case "create":
            return await create(args);
          case "update":
            return await update(args);
          case "delete":
            return await remove(args);
          case "act":
            return await act(args);
          default:
            return null;
        }
      } catch (error) {
        if (error instanceof FieldError || error instanceof SyntaxError)
          return { error: error.message };
        throw error;
      }
    },
  };
}
