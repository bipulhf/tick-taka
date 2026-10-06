/**
 * On-phone quick-add parser. Turns one line of text into a draft task, expense,
 * income or time entry, instantly and offline. Low-confidence results are what the
 * app sends to the AI parser; nothing here is ever saved without a tap.
 */

import { MINUTE_MS } from "./dates";
import { toAsciiDigits } from "./digits";
import { guessArea, hasNonLatinLetters } from "./quick-add-guess";
import { parseMoney, parseMoneyList } from "./quick-add-money";
import { parseTask } from "./quick-add-task";

export type QuickAddKind = "expense" | "income" | "task" | "time_entry";
export type Confidence = "high" | "low";

export interface QuickAddContext {
  now: number;
  timeZone?: string;
  accounts: { id: string; name: string; type?: string; currency?: string }[];
  defaultAccountId: string | null;
  categories: { id: string; name: string; kind: "expense" | "income"; parentId: string | null }[];
  areas: { id: string; name: string }[];
  rules?: { matchText: string; categoryId: string | null; areaId: string | null }[];
  workdays?: number[];
}

export interface MoneyDraft {
  kind: "expense" | "income";
  amountMinor: number | null;
  accountId: string | null;
  categoryId: string | null;
  areaId: string | null;
  note: string;
  occurredAt: number;
  confidence: Confidence;
}

export interface TaskDraft {
  kind: "task";
  title: string;
  doAt: number | null;
  hasTime: boolean;
  reminderAt: number | null;
  deadlineAt: number | null;
  rrule: string | null;
  whenSlot: "day" | "evening";
  status: "inbox" | "open" | "someday";
  priority: "low" | "normal" | "high";
  areaId: string | null;
  confidence: Confidence;
}

export interface TimeEntryDraft {
  kind: "time_entry";
  minutes: number;
  note: string;
  areaId: string | null;
  startedAt: number;
  endedAt: number;
  confidence: Confidence;
}

export type QuickAddDraft = MoneyDraft | TaskDraft | TimeEntryDraft;

/** Transfers only come from the AI parser; quick-add never infers them. */
export interface TransferDraft {
  kind: "transfer";
  amountMinor: number | null;
  feeMinor: number;
  accountId: string | null;
  toAccountId: string | null;
  note: string;
  occurredAt: number;
  confidence: Confidence;
}

export type AnyDraft = QuickAddDraft | TransferDraft;

const DURATION_RE =
  /^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours|ঘণ্টা|ঘন্টা))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes|মিনিট))?(?=\s|$)/i;

function parseDuration(text: string): { minutes: number; rest: string } | null {
  // Digit conversion keeps the length, so the match length also slices the original text.
  const match = DURATION_RE.exec(toAsciiDigits(text.trim()));
  if (!match || (!match[1] && !match[2]) || match[0].trim() === "") return null;
  const minutes = Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0));
  if (minutes <= 0) return null;
  return { minutes, rest: text.trim().slice(match[0].length).trim() };
}

/** A closing danda, full stop or "!" after an amount ("চা ২০।") is punctuation, not text. */
const TRAILING_PUNCTUATION_RE = /[\s।.!]+$/u;

function parseTimeEntry(text: string, context: QuickAddContext): TimeEntryDraft | null {
  const duration = parseDuration(text);
  if (!duration) return null;
  const areaId = guessArea(duration.rest, context);
  return {
    kind: "time_entry",
    minutes: duration.minutes,
    note: duration.rest,
    areaId,
    startedAt: context.now - duration.minutes * MINUTE_MS,
    endedAt: context.now,
    confidence:
      duration.rest.length > 0 && (areaId !== null || !hasNonLatinLetters(duration.rest))
        ? "high"
        : "low",
  };
}

/**
 * Parses quick-add text. `forceKind` comes from the type chips above the field and
 * overrides detection.
 */
export function parseQuickAdd(
  text: string,
  context: QuickAddContext,
  forceKind?: QuickAddKind,
): QuickAddDraft | null {
  const input = text.trim();
  if (!input) return null;
  if (forceKind === "task") return parseTask(input, context);
  if (forceKind === "time_entry") {
    return (
      parseTimeEntry(input, context) ?? {
        kind: "time_entry",
        minutes: 0,
        note: input,
        areaId: guessArea(input, context),
        startedAt: context.now,
        endedAt: context.now,
        confidence: "low",
      }
    );
  }
  const moneyText = input.replace(TRAILING_PUNCTUATION_RE, "");
  if (forceKind === "expense" || forceKind === "income")
    return (
      parseMoneyList(moneyText, context, forceKind) ?? parseMoney(moneyText, context, forceKind)
    );

  const timeEntry = parseTimeEntry(input, context);
  if (timeEntry) return timeEntry;
  const money = parseMoneyList(moneyText, context) ?? parseMoney(moneyText, context);
  if (money) return money;
  return parseTask(input, context);
}

/** One-line preview shown above Save, e.g. "Expense ৳250 · Food · Cash". */
export function describeDraft(
  draft: QuickAddDraft,
  names: { account?: string | null; category?: string | null; area?: string | null },
  formatAmount: (minor: number) => string,
  formatWhen: (ms: number, hasTime: boolean) => string,
): string {
  const parts: string[] = [];
  switch (draft.kind) {
    case "expense":
    case "income":
      parts.push(
        `${draft.kind === "expense" ? "Expense" : "Income"} ${draft.amountMinor === null ? "—" : formatAmount(draft.amountMinor)}`,
      );
      if (names.category) parts.push(names.category);
      if (names.account) parts.push(names.account);
      if (draft.note) parts.push(`“${draft.note}”`);
      break;
    case "task":
      parts.push(`Task “${draft.title}”`);
      if (draft.status === "someday") parts.push("Someday");
      else if (draft.doAt !== null) parts.push(formatWhen(draft.doAt, draft.hasTime));
      if (draft.whenSlot === "evening") parts.push("Evening");
      if (draft.rrule) parts.push("Repeats");
      if (names.area) parts.push(names.area);
      break;
    case "time_entry": {
      const hours = Math.floor(draft.minutes / 60);
      const minutes = draft.minutes % 60;
      parts.push(`Time ${hours ? `${hours}h` : ""}${minutes ? `${minutes}m` : ""}`.trim());
      if (names.area) parts.push(names.area);
      if (draft.note) parts.push(`“${draft.note}”`);
      break;
    }
  }
  return parts.join(" · ");
}
