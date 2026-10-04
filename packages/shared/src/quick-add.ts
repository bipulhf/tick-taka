/**
 * On-phone quick-add parser. Turns one line of text into a draft task, expense,
 * income or time entry, instantly and offline. Low-confidence results are what the
 * app sends to the AI parser; nothing here is ever saved without a tap.
 */

import * as chrono from "chrono-node";
import { isAmountExpression, tryEvaluateExpression } from "./calculator";
import {
  addDays,
  DEFAULT_TIME_ZONE,
  MINUTE_MS,
  startOfLocalDay,
  timeZoneOffsetMs,
  toLocalDate,
  zonedTimeToUtc,
} from "./dates";
import { DEFAULT_AREAS, DEFAULT_CATEGORIES } from "./defaults";
import { DEFAULT_CURRENCY, toMinor } from "./money";
import { firstOccurrence, parseRecurrence } from "./recurrence";

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

/** Transfers only come from the AI parser (e.g. an SMS cash-out); quick-add never infers them. */
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

const normalize = (value: string) => value.trim().toLowerCase();

const WALLET_ALIASES: Record<string, string[]> = {
  bkash: ["bkash", "bk"],
  nagad: ["nagad"],
  rocket: ["rocket"],
  cash: ["cash", "wallet"],
  card: ["card", "visa", "mastercard"],
};

function findAccount(token: string, accounts: QuickAddContext["accounts"]): string | null {
  const word = normalize(token);
  if (word.length < 2) return null;
  const byName = accounts.find(
    (a) => normalize(a.name) === word || normalize(a.name).split(/\s+/)[0] === word,
  );
  if (byName) return byName.id;
  for (const [canonical, aliases] of Object.entries(WALLET_ALIASES)) {
    if (!aliases.includes(word)) continue;
    const match = accounts.find(
      (a) => normalize(a.name).includes(canonical) || a.type === canonical,
    );
    if (match) return match.id;
  }
  return null;
}

function categoryIdByName(name: string, context: QuickAddContext): string | null {
  return context.categories.find((c) => normalize(c.name) === normalize(name))?.id ?? null;
}

function containsWord(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\W)${escaped}(\\W|$)`, "i").test(haystack);
}

interface CategoryGuess {
  categoryId: string | null;
  areaId: string | null;
  kind: "expense" | "income" | null;
}

/** Learned rules win over built-in keywords, as with Copilot's learn-from-corrections. */
export function guessCategory(note: string, context: QuickAddContext): CategoryGuess {
  const text = normalize(note);
  if (!text) return { categoryId: null, areaId: null, kind: null };
  const rule = [...(context.rules ?? [])]
    .sort((a, b) => b.matchText.length - a.matchText.length)
    .find((r) => r.matchText && text.includes(normalize(r.matchText)));
  if (rule) {
    const category = context.categories.find((c) => c.id === rule.categoryId);
    return { categoryId: rule.categoryId, areaId: rule.areaId, kind: category?.kind ?? null };
  }
  for (const parent of DEFAULT_CATEGORIES) {
    for (const child of parent.children ?? []) {
      if (child.keywords.some((k) => containsWord(text, k))) {
        const id = categoryIdByName(child.name, context) ?? categoryIdByName(parent.name, context);
        if (id) return { categoryId: id, areaId: null, kind: parent.kind };
      }
    }
    if (parent.keywords.some((k) => containsWord(text, k))) {
      const id = categoryIdByName(parent.name, context);
      if (id) return { categoryId: id, areaId: null, kind: parent.kind };
    }
  }
  const direct = context.categories.find((c) => containsWord(text, c.name));
  return direct
    ? { categoryId: direct.id, areaId: null, kind: direct.kind }
    : { categoryId: null, areaId: null, kind: null };
}

export function guessArea(text: string, context: QuickAddContext): string | null {
  const lower = normalize(text);
  const named = context.areas.find((a) => containsWord(lower, a.name));
  if (named) return named.id;
  for (const area of DEFAULT_AREAS) {
    if (area.keywords.some((k) => containsWord(lower, k))) {
      const match = context.areas.find((a) => normalize(a.name) === normalize(area.name));
      if (match) return match.id;
    }
  }
  return null;
}

const DURATION_RE =
  /^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?(?=\s|$)/i;

function parseDuration(text: string): { minutes: number; rest: string } | null {
  const match = DURATION_RE.exec(text.trim());
  if (!match || (!match[1] && !match[2]) || match[0].trim() === "") return null;
  const minutes = Math.round(Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0));
  if (minutes <= 0) return null;
  return { minutes, rest: text.trim().slice(match[0].length).trim() };
}

function relativeDayOffset(tokens: string[]): { offset: number; rest: string[] } {
  const rest = tokens.filter((t) => !["yesterday", "today"].includes(normalize(t)));
  const offset = tokens.some((t) => normalize(t) === "yesterday") ? -1 : 0;
  return { offset, rest };
}

const DATE_WORD_RE = new RegExp(
  `^(${["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec"].join("|")})[a-z]*$|^(on|by|at|before|due|the|until|till)$`,
  "i",
);

/** True when a numeric token is part of a date or time phrase, e.g. "Oct 30" or "at 5". */
function isPartOfDate(tokens: string[], index: number): boolean {
  const previous = tokens[index - 1];
  const next = tokens[index + 1];
  if (previous && DATE_WORD_RE.test(previous)) return true;
  if (next && /^(am|pm|o'?clock)$/i.test(next)) return true;
  if (
    next &&
    /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(next) &&
    /^\d{1,2}$/.test(tokens[index]!)
  )
    return true;
  return false;
}

function parseMoney(
  text: string,
  context: QuickAddContext,
  forced?: "expense" | "income",
): MoneyDraft | null {
  const timeZone = context.timeZone ?? DEFAULT_TIME_ZONE;
  let body = text.trim();
  let incomeSign = false;
  if (body.startsWith("+")) {
    incomeSign = true;
    body = body.slice(1).trim();
  }
  const { offset, rest: tokens } = relativeDayOffset(body.split(/\s+/).filter(Boolean));
  let accountId: string | null = null;
  let amountIndex = -1;
  // Amount is the last token, the second-last when an account follows ("rickshaw 60 bkash"),
  // or the first token. Numbers that belong to a date ("by Oct 30") never count.
  const last = tokens.length - 1;
  const isAmountAt = (index: number) =>
    index >= 0 &&
    index < tokens.length &&
    isAmountExpression(tokens[index]!) &&
    !isPartOfDate(tokens, index);
  if (isAmountAt(last)) {
    amountIndex = last;
  } else if (isAmountAt(last - 1) && findAccount(tokens[last]!, context.accounts)) {
    amountIndex = last - 1;
    accountId = findAccount(tokens[last]!, context.accounts);
  } else if (isAmountAt(0)) {
    amountIndex = 0;
  }
  if (amountIndex === -1 && !forced) return null;
  const value = amountIndex >= 0 ? tryEvaluateExpression(tokens[amountIndex]!) : null;
  if (amountIndex >= 0 && (value === null || value <= 0)) return null;
  const remaining = tokens.filter(
    (_, i) => i !== amountIndex && !(accountId && i === amountIndex + 1),
  );
  // An account named anywhere else in the text ("bkash lunch 250").
  if (!accountId) {
    const idx = remaining.findIndex((t) => findAccount(t, context.accounts));
    if (idx >= 0) {
      accountId = findAccount(remaining[idx]!, context.accounts);
      remaining.splice(idx, 1);
    }
  }
  const note = remaining.join(" ");
  const guess = guessCategory(note, context);
  const kind: "expense" | "income" =
    forced ?? (incomeSign || guess.kind === "income" ? "income" : "expense");
  const categoryId = guess.kind === null || guess.kind === kind ? guess.categoryId : null;
  accountId ??= context.defaultAccountId;
  const currency = context.accounts.find((a) => a.id === accountId)?.currency ?? DEFAULT_CURRENCY;
  const occurredAt = offset === 0 ? context.now : addDaysToInstant(context.now, offset, timeZone);
  return {
    kind,
    amountMinor: value === null ? null : toMinor(value, currency),
    accountId,
    categoryId,
    areaId: guess.areaId ?? guessArea(note, context),
    note,
    occurredAt,
    confidence: value !== null && categoryId !== null && accountId !== null ? "high" : "low",
  };
}

function addDaysToInstant(ms: number, days: number, timeZone: string): number {
  const localDate = addDays(toLocalDate(ms, timeZone), days);
  return startOfLocalDay(localDate, timeZone) + 12 * 60 * MINUTE_MS;
}

const EVENING_RE = /\b(tonight|this evening|in the evening|evening)\b/i;
const SOMEDAY_RE = /\b(someday|some day|one day|eventually)\b/i;
const PRIORITY_HIGH_RE = /(^|\s)(!!?|!high|urgent|asap|important)(?=\s|$)/i;
const PRIORITY_LOW_RE = /(^|\s)(!low|low priority)(?=\s|$)/i;
const DEADLINE_PREFIX_RE = /\b(by|due|deadline|before)\s*$/i;

function parseTask(text: string, context: QuickAddContext): TaskDraft {
  const timeZone = context.timeZone ?? DEFAULT_TIME_ZONE;
  let working = text.trim();
  let priority: TaskDraft["priority"] = "normal";
  if (PRIORITY_HIGH_RE.test(working)) {
    priority = "high";
    working = working.replace(PRIORITY_HIGH_RE, " ");
  } else if (PRIORITY_LOW_RE.test(working)) {
    priority = "low";
    working = working.replace(PRIORITY_LOW_RE, " ");
  }
  let whenSlot: TaskDraft["whenSlot"] = "day";
  if (EVENING_RE.test(working)) {
    whenSlot = "evening";
    working = working.replace(/\b(this evening|in the evening|evening)\b/i, " ");
  }
  let status: TaskDraft["status"] = "inbox";
  if (SOMEDAY_RE.test(working)) {
    status = "someday";
    working = working.replace(SOMEDAY_RE, " ");
  }

  const recurrence = parseRecurrence(
    working,
    context.workdays ? { workdays: context.workdays } : {},
  );
  if (recurrence) working = recurrence.rest;

  const offsetMinutes = timeZoneOffsetMs(context.now, timeZone) / MINUTE_MS;
  const results = chrono.parse(
    working,
    { instant: new Date(context.now), timezone: offsetMinutes },
    { forwardDate: true },
  );

  let doAt: number | null = null;
  let hasTime = false;
  let deadlineAt: number | null = null;
  const removals: { index: number; length: number }[] = [];
  for (const result of results) {
    const before = working.slice(0, result.index);
    const deadlinePrefix = DEADLINE_PREFIX_RE.exec(before);
    const certainTime = result.start.isCertain("hour");
    const instant = result.start.date().getTime();
    const local = toLocalDate(instant, timeZone);
    if (deadlinePrefix && deadlineAt === null) {
      deadlineAt = certainTime
        ? instant
        : startOfLocalDay(local, timeZone) + (23 * 60 + 59) * MINUTE_MS;
      removals.push({
        index: deadlinePrefix.index,
        length: before.length - deadlinePrefix.index + result.text.length,
      });
    } else if (doAt === null) {
      hasTime = certainTime;
      doAt = certainTime ? instant : startOfLocalDay(local, timeZone);
      removals.push({ index: result.index, length: result.text.length });
    }
  }
  for (const removal of removals.sort((a, b) => b.index - a.index)) {
    working = `${working.slice(0, removal.index)} ${working.slice(removal.index + removal.length)}`;
  }

  let rrule: string | null = null;
  if (recurrence) {
    rrule = recurrence.rrule;
    if (doAt === null) {
      const first = firstOccurrence(recurrence.rule, toLocalDate(context.now, timeZone));
      if (first) {
        const { byHour, byMinute } = recurrence.rule;
        if (byHour !== undefined) {
          const [y, m, d] = first.split("-").map(Number) as [number, number, number];
          doAt = zonedTimeToUtc(
            { year: y, month: m, day: d, hour: byHour, minute: byMinute ?? 0 },
            timeZone,
          );
          hasTime = true;
        } else {
          doAt = startOfLocalDay(first, timeZone);
        }
      }
    }
  }

  const title = working
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
  const strayNumber = /\b\d+(\.\d+)?\b/.test(title);
  return {
    kind: "task",
    title: title ? title.charAt(0).toUpperCase() + title.slice(1) : text.trim(),
    doAt: status === "someday" ? null : doAt,
    hasTime: status === "someday" ? false : hasTime,
    reminderAt: hasTime && status !== "someday" ? doAt : null,
    deadlineAt,
    rrule,
    whenSlot,
    status,
    priority,
    areaId: guessArea(text, context),
    confidence: title.length > 0 && !strayNumber ? "high" : "low",
  };
}

function parseTimeEntry(text: string, context: QuickAddContext): TimeEntryDraft | null {
  const duration = parseDuration(text);
  if (!duration) return null;
  return {
    kind: "time_entry",
    minutes: duration.minutes,
    note: duration.rest,
    areaId: guessArea(duration.rest, context),
    startedAt: context.now - duration.minutes * MINUTE_MS,
    endedAt: context.now,
    confidence: duration.rest.length > 0 ? "high" : "low",
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
  if (forceKind === "expense" || forceKind === "income")
    return parseMoney(input, context, forceKind);

  const timeEntry = parseTimeEntry(input, context);
  if (timeEntry) return timeEntry;
  const money = parseMoney(input, context);
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
