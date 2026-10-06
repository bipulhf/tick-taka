import { isLocalDate, startOfLocalDay, toLocalDate, zonedTimeToUtc } from "@tick-taka/shared/dates";
import { defined } from "@tick-taka/shared/defined";
import { toMajor, toMinor } from "@tick-taka/shared/money";
import type { Caller } from "./dispatch";

/** Friendly field names the model uses for money, mapped to the API's minor-unit fields. */
const MONEY: Record<string, string> = {
  amount: "amountMinor",
  toAmount: "toAmountMinor",
  fee: "feeMinor",
  opening: "openingMinor",
  target: "targetMinor",
  principal: "principalMinor",
  budget: "budgetMinor",
  est: "estMinor",
  limit: "limitMinor",
  actual: "actualMinor",
  received: "receivedMinor",
};

/** Names (or ids) the model may pass instead of ids. */
const REFS: Record<string, { key: string; kind: RefKind }> = {
  area: { key: "areaId", kind: "area" },
  project: { key: "projectId", kind: "project" },
  account: { key: "accountId", kind: "account" },
  toAccount: { key: "toAccountId", kind: "account" },
  fromAccount: { key: "fromAccountId", kind: "account" },
  category: { key: "categoryId", kind: "category" },
  goal: { key: "goalId", kind: "goal" },
  event: { key: "eventId", kind: "event" },
  task: { key: "taskId", kind: "task" },
  parent: { key: "parentId", kind: "task" },
};
type RefKind = "area" | "project" | "account" | "category" | "goal" | "event" | "task";

const REF_PATHS: Record<Exclude<RefKind, "task">, string> = {
  area: "/areas",
  project: "/projects",
  account: "/accounts",
  category: "/categories",
  goal: "/goals",
  event: "/events",
};

const EPOCH_KEYS = new Set([
  "doAt",
  "deadlineAt",
  "reminderAt",
  "occurredAt",
  "startedAt",
  "endedAt",
  "nextDueAt",
  "dueAt",
  "remindAt",
]);
const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/;
const LOCAL_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/;
const DROP = new Set(["createdAt", "updatedAt", "deletedAt", "sort", "color", "receiptPath"]);

export class FieldError extends Error {}

const norm = (value: string) => value.trim().toLowerCase();

/** Converts the model's fields (taka, local dates, names) into an API body. */
export function createFieldConverter(caller: Caller, timeZone: string, now: number) {
  const named = new Map<string, { id: string; name: string }[]>();

  async function options(kind: Exclude<RefKind, "task">) {
    const cached = named.get(kind);
    if (cached) return cached;
    const result = await caller.call("GET", REF_PATHS[kind]);
    const list = (Array.isArray(result.data) ? result.data : []) as { id: string; name: string }[];
    named.set(kind, list);
    return list;
  }

  async function resolve(kind: RefKind, value: unknown): Promise<string | null> {
    if (value === null) return null;
    if (typeof value !== "string") throw new FieldError(`${kind} must be a name or id`);
    if (ULID.test(value) || kind === "task") return value;
    const list = await options(kind);
    const match =
      list.find((item) => norm(item.name) === norm(value)) ??
      list.find((item) => norm(item.name).includes(norm(value)));
    if (!match)
      throw new FieldError(
        `No ${kind} called "${value}". Existing: ${list.map((item) => item.name).join(", ") || "none"}`,
      );
    return match.id;
  }

  function epoch(key: string, value: unknown): unknown {
    if (typeof value !== "string") return value;
    if (value === "now") return now;
    const time = LOCAL_TIME.exec(value);
    if (time) {
      const [year, month, day, hour, minute] = time.slice(1).map(Number);
      return zonedTimeToUtc(
        {
          year: defined(year, "the year"),
          month: defined(month, "the month"),
          day: defined(day, "the day"),
          hour,
          minute,
        },
        timeZone,
      );
    }
    if (isLocalDate(value)) return startOfLocalDay(value, timeZone);
    // A habit's reminder is a clock time and stays as text.
    if (key === "remindAt" && /^\d{2}:\d{2}$/.test(value)) return value;
    throw new FieldError(`${key} must be YYYY-MM-DD or YYYY-MM-DD HH:mm`);
  }

  return async function convert(fields: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {};
    const currency = typeof fields.currency === "string" ? fields.currency : "BDT";
    for (const [key, value] of Object.entries(fields)) {
      const moneyKey = MONEY[key];
      const ref = REFS[key];
      if (moneyKey !== undefined) {
        if (value !== null && !Number.isFinite(Number(value)))
          throw new FieldError(`${key} must be a number of taka`);
        body[moneyKey] = value === null ? null : toMinor(Number(value), currency);
      } else if (ref !== undefined) {
        body[ref.key] = await resolve(ref.kind, value);
      } else if (EPOCH_KEYS.has(key)) {
        body[key] = epoch(key, value);
      } else if (key === "steps" && Array.isArray(value)) {
        body.steps = value;
      } else {
        body[key] = value;
      }
    }
    if (typeof fields.doAt === "string" && fields.hasTime === undefined)
      body.hasTime = LOCAL_TIME.test(fields.doAt);
    return body;
  };
}

/** Shrinks an API record for the model: taka instead of minor units, local times, no bookkeeping fields. */
export function project(value: unknown, timeZone: string, depth = 0): unknown {
  if (Array.isArray(value))
    return value.slice(0, 30).map((item) => project(item, timeZone, depth + 1));
  if (!value || typeof value !== "object") return value;
  if (depth > 3) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (DROP.has(key) || raw === null || raw === undefined) continue;
    if (key.endsWith("Minor") && typeof raw === "number") {
      out[key.slice(0, -5)] = toMajor(raw);
    } else if (key.endsWith("At") && typeof raw === "number" && raw > 1e11) {
      const date = toLocalDate(raw, timeZone);
      const time = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(raw);
      out[key] = `${date} ${time}`;
    } else {
      out[key] = project(raw, timeZone, depth + 1);
    }
  }
  return out;
}
