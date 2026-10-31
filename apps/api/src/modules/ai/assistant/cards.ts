import { isLocalDate } from "@tick-taka/shared/dates";
import { formatAmount, toMinor } from "@tick-taka/shared/money";
import type { AssistantCard, AssistantRecordKind } from "@tick-taka/shared/schemas/ai";
import { ENTITY_KIND, type EntityName } from "./entities";

/** Record cards per answer: what Tiki changed first, then what it found and named. */
const MAX_RECORDS = 6;
const MAX_TOTALS = 3;
/** Shorter titles match too much of an ordinary reply ("Tea" in "team"). */
const MIN_NAMED = 3;

type RecordCard = Extract<AssistantCard, { type: "record" }>;
type TotalCard = Extract<AssistantCard, { type: "total" }>;
type Row = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

/** What the user calls the record, as the app shows it. */
function titleOf(kind: AssistantRecordKind, row: Row): string {
  const own = text(row.title) ?? text(row.name) ?? text(row.person) ?? text(row.note);
  if (own) return own.slice(0, 60);
  if (kind === "transaction" && typeof row.type === "string")
    return `${row.type.charAt(0).toUpperCase()}${row.type.slice(1)}`;
  return kind.replace("_", " ");
}

function dayOf(epoch: number, timeZone: string, withTime: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  }).format(epoch);
}

/** One short detail line: an amount or a date, whichever the record is about. */
function subtitleOf(kind: AssistantRecordKind, row: Row, timeZone: string): string | undefined {
  const currency = text(row.currency) ?? undefined;
  const money = (key: string) => {
    const minor = num(row[key]);
    return minor === null ? null : formatAmount(minor, { currency });
  };
  const when = (key: string, withTime = false) => {
    const at = num(row[key]);
    return at === null ? null : dayOf(at, timeZone, withTime);
  };
  const parts: (string | null)[] = (() => {
    switch (kind) {
      case "task":
        return [when("doAt", row.hasTime === true), row.status === "done" ? "done" : null];
      case "transaction":
        return [money("amountMinor"), when("occurredAt")];
      case "recurring":
        return [money("amountMinor"), when("nextDueAt")];
      case "goal":
        return [money("targetMinor")];
      case "debt":
        return [money("principalMinor")];
      case "event":
        return [isLocalDate(String(row.startsOn)) ? String(row.startsOn) : null];
      case "time_entry":
        return [when("startedAt", true)];
      default:
        return [];
    }
  })();
  const shown = parts.filter((part): part is string => part !== null);
  return shown.length ? shown.join(", ") : undefined;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const shortDate = (date: string) =>
  `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

/** "4 Oct" or "1 Oct to 31 Oct", from a report's range. */
function span(args: Row): string | null {
  const { from, to } = args;
  if (typeof from !== "string" || typeof to !== "string" || !isLocalDate(from) || !isLocalDate(to))
    return null;
  return from === to ? shortDate(from) : `${shortDate(from)} to ${shortDate(to)}`;
}

const labelled = (label: string, args: Row) => {
  const range = span(args);
  return range ? `${label}, ${range}` : label;
};
const sumMinor = (rows: unknown, key: string) =>
  Array.isArray(rows)
    ? rows.reduce((sum: number, row) => sum + toMinor(num((row as Row)[key]) ?? 0), 0)
    : 0;

/** The totals a report tool's answer adds up to (amounts arrive in taka). */
function totalsOf(name: string, args: Row, output: unknown): TotalCard[] {
  switch (name) {
    case "spendByCategory":
    case "spendByArea":
      return [
        { type: "total", label: labelled("Spent", args), amountMinor: sumMinor(output, "taka") },
      ];
    case "incomeByCategory":
      return [
        { type: "total", label: labelled("Income", args), amountMinor: sumMinor(output, "taka") },
      ];
    case "hoursByArea": {
      const hours = Array.isArray(output)
        ? output.reduce((sum: number, row) => sum + (num((row as Row).hours) ?? 0), 0)
        : 0;
      return [{ type: "total", label: labelled("Tracked", args), minutes: Math.round(hours * 60) }];
    }
    case "tasksCompleted":
      return [
        {
          type: "total",
          label: labelled("Tasks finished", args),
          count: num((output as Row | null)?.total) ?? 0,
        },
      ];
    case "accountBalances": {
      const rows = (Array.isArray(output) ? output : []) as Row[];
      // One number only makes sense in one currency.
      if (rows.length === 0 || rows.some((row) => row.currency !== "BDT")) return [];
      return [{ type: "total", label: "All accounts", amountMinor: sumMinor(rows, "balance") }];
    }
    case "budgetStatus":
      return [
        {
          type: "total",
          label:
            typeof args.month === "string" ? `Left in budgets, ${args.month}` : "Left in budgets",
          amountMinor: sumMinor(output, "left"),
        },
      ];
    case "debtsSummary": {
      const rows = (Array.isArray(output) ? output : []) as Row[];
      const side = (direction: string, label: string): TotalCard[] => {
        const mine = rows.filter((row) => row.direction === direction);
        return mine.length
          ? [{ type: "total", label, amountMinor: sumMinor(mine, "outstanding") }]
          : [];
      };
      return [...side("owed_to_me", "Owed to you"), ...side("i_owe", "You owe")];
    }
    default:
      return [];
  }
}

/**
 * Collects what an answer can link to while the turn runs: records Tiki created
 * or changed, records it found (kept only when the reply names them) and the
 * totals its reports added up. Each card is small; the app opens the record itself.
 */
export function createCardCollector(timeZone: string) {
  const touched = new Map<string, RecordCard>();
  const found = new Map<string, RecordCard>();
  const totals = new Map<string, TotalCard>();

  const cardOf = (entity: EntityName, row: unknown): RecordCard | null => {
    const kind = ENTITY_KIND[entity];
    if (!kind || !row || typeof row !== "object") return null;
    const record = row as Row;
    if (typeof record.id !== "string") return null;
    const subtitle = subtitleOf(kind, record, timeZone);
    return {
      type: "record",
      kind,
      id: record.id,
      title: titleOf(kind, record),
      ...(subtitle ? { subtitle } : {}),
    };
  };

  return {
    /** A record created or changed this turn. */
    touched(entity: EntityName, row: unknown): void {
      const card = cardOf(entity, row);
      if (!card) return;
      const key = `${card.kind}:${card.id}`;
      // A later change has the newer title; the first change keeps its place.
      touched.set(key, card);
    },
    /** Records a find returned. */
    found(entity: EntityName, rows: unknown[]): void {
      for (const row of rows) {
        const card = cardOf(entity, row);
        if (card) found.set(`${card.kind}:${card.id}`, card);
      }
    },
    /** A report tool's answer. */
    report(name: string, rawArgs: string, output: unknown): void {
      let args: Row = {};
      try {
        args = JSON.parse(rawArgs || "{}") as Row;
      } catch {}
      for (const card of totalsOf(name, args, output)) totals.set(card.label, card);
    },
    /** The cards for the final reply. */
    list(reply: string): AssistantCard[] {
      const said = reply.toLowerCase();
      const named = [...found.entries()].filter(
        ([key, card]) =>
          !touched.has(key) &&
          card.title.length >= MIN_NAMED &&
          said.includes(card.title.toLowerCase()),
      );
      const records = [...touched.values(), ...named.map(([, card]) => card)].slice(0, MAX_RECORDS);
      return [...records, ...[...totals.values()].slice(-MAX_TOTALS)];
    },
  };
}

export type CardCollector = ReturnType<typeof createCardCollector>;
