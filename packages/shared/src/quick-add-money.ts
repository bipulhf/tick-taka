/**
 * The money half of quick-add: one priced line ("rickshaw 60 bkash"), or several
 * priced items on one line, into an expense or income draft.
 */

import { expressionToMinor, isAmountExpression } from "./calculator";
import { addDays, DEFAULT_TIME_ZONE, MINUTE_MS, startOfLocalDay, toLocalDate } from "./dates";
import { toAsciiDigits } from "./digits";
import { CURRENCY_WORD_RE, DEFAULT_CURRENCY, stripCurrency } from "./money";
import type { MoneyDraft, QuickAddContext } from "./quick-add";
import { guessArea, guessCategory, normalize } from "./quick-add-guess";

const WALLET_ALIASES: Record<string, string[]> = {
  bkash: ["bkash", "bk", "বিকাশ"],
  nagad: ["nagad", "নগদ"],
  rocket: ["rocket", "রকেট"],
  cash: ["cash", "wallet", "ক্যাশ"],
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

const YESTERDAY_WORDS = ["yesterday", "গতকাল"];
const TODAY_WORDS = ["today", "আজ", "আজকে"];

function relativeDayOffset(tokens: string[]): { offset: number; rest: string[] } {
  const rest = tokens.filter((t) => ![...YESTERDAY_WORDS, ...TODAY_WORDS].includes(normalize(t)));
  const offset = tokens.some((t) => YESTERDAY_WORDS.includes(normalize(t))) ? -1 : 0;
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
    /^\d{1,2}$/.test(tokens[index] ?? "")
  )
    return true;
  return false;
}

/**
 * Words that make the number after them a label, not a price: "read chapter 5",
 * "room 302", "lecture 3". Only used when nothing forced the text to be money.
 */
const LABEL_WORDS = new Set(
  [
    "chapter ch chap page pg p pp room rm lecture lec class section sec unit part episode",
    "ep season level step no number num question q problem exercise ex lesson module",
    "assignment hw homework quiz slide figure fig item issue pr version v vol volume floor",
    "road block sector gate platform row batch group team grade semester sem week day round",
    "phase sprint task verse surah ayat juz",
    "অধ্যায় পৃষ্ঠা পাতা রুম ক্লাস লেকচার নম্বর নং",
  ]
    .join(" ")
    .split(" ")
    .map((word) => word.normalize("NFC")),
);

/** "Chapter 5", "৩ নম্বর", or a number with a leading zero (a phone number, "007"). */
function isLabelNumber(plain: string[], index: number): boolean {
  if (/^0\d/.test(plain[index] ?? "")) return true;
  const previous = plain[index - 1]
    ?.toLowerCase()
    .normalize("NFC")
    .replace(/[.:#]$/, "");
  const next = plain[index + 1]?.toLowerCase().normalize("NFC");
  return (
    (previous !== undefined && LABEL_WORDS.has(previous)) ||
    (next !== undefined && (next === "নম্বর" || next === "নং"))
  );
}

export function parseMoney(
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
  const { offset, rest: words } = relativeDayOffset(body.split(/\s+/).filter(Boolean));
  // A currency word next to a number is not part of the note ("চা ২০ টাকা", "Tk 250 lunch").
  const isNumber = (token: string | undefined) =>
    token !== undefined && isAmountExpression(stripCurrency(token));
  const tokens = words.filter(
    (t, i) => !(CURRENCY_WORD_RE.test(t) && (isNumber(words[i - 1]) || isNumber(words[i + 1]))),
  );
  // ASCII digits and no currency sign, for detection only; the note keeps what was typed.
  const plain = tokens.map(stripCurrency);
  let accountId: string | null = null;
  let amountIndex = -1;
  // Amount is the last token, the second-last when an account follows ("rickshaw 60 bkash"),
  // or the first token. Numbers that belong to a date ("by Oct 30") never count.
  const last = tokens.length - 1;
  const isAmountAt = (index: number) =>
    index >= 0 &&
    index < tokens.length &&
    isAmountExpression(plain[index] ?? "") &&
    !isPartOfDate(plain, index) &&
    (forced !== undefined || !isLabelNumber(plain, index));
  if (isAmountAt(last)) {
    amountIndex = last;
  } else if (isAmountAt(last - 1) && findAccount(tokens[last] ?? "", context.accounts)) {
    amountIndex = last - 1;
    accountId = findAccount(tokens[last] ?? "", context.accounts);
  } else if (isAmountAt(0)) {
    amountIndex = 0;
  }
  if (amountIndex === -1 && !forced) return null;
  const remaining = tokens.filter(
    (_, i) => i !== amountIndex && !(accountId && i === amountIndex + 1),
  );
  // An account named anywhere else in the text ("bkash lunch 250").
  if (!accountId) {
    const idx = remaining.findIndex((t) => findAccount(t, context.accounts));
    if (idx >= 0) {
      accountId = findAccount(remaining[idx] ?? "", context.accounts);
      remaining.splice(idx, 1);
    }
  }
  const note = remaining.join(" ");
  const guess = guessCategory(note, context);
  // A leading number with nothing money-like around it is a count, not a price:
  // "3 slides for class" is a task, "250 lunch" and "৳300 gift" are expenses.
  const currencyMarked =
    words.length !== tokens.length ||
    (amountIndex >= 0 && plain[amountIndex] !== toAsciiDigits(tokens[amountIndex] ?? ""));
  if (
    amountIndex === 0 &&
    tokens.length > 1 &&
    !forced &&
    !incomeSign &&
    !currencyMarked &&
    accountId === null &&
    guess.categoryId === null
  )
    return null;
  const kind: "expense" | "income" =
    forced ?? (incomeSign || guess.kind === "income" ? "income" : "expense");
  const categoryId = guess.kind === null || guess.kind === kind ? guess.categoryId : null;
  accountId ??= context.defaultAccountId;
  const currency = context.accounts.find((a) => a.id === accountId)?.currency ?? DEFAULT_CURRENCY;
  const amountMinor =
    amountIndex >= 0 ? expressionToMinor(plain[amountIndex] ?? "", currency) : null;
  if (amountIndex >= 0 && (amountMinor === null || amountMinor <= 0)) return null;
  const occurredAt = offset === 0 ? context.now : addDaysToInstant(context.now, offset, timeZone);
  // Another price left in the note ("চা ২০ সিঙ্গারা ১০") means only one was taken: let
  // the AI (or the preview) have a look rather than save half at high confidence.
  const strayAmount = plain.some(
    (token, i) =>
      i !== amountIndex &&
      isAmountExpression(token) &&
      !isPartOfDate(plain, i) &&
      !isLabelNumber(plain, i),
  );
  return {
    kind,
    amountMinor,
    accountId,
    categoryId,
    areaId: guess.areaId ?? guessArea(note, context),
    note,
    occurredAt,
    confidence:
      amountMinor !== null && categoryId !== null && accountId !== null && !strayAmount
        ? "high"
        : "low",
  };
}

/** A comma or "+" between items, not inside a number: "চা ২০, সিঙ্গারা ১০", "tea 20 + bun 15". */
const ITEM_SEPARATOR_RE = /\s*[,+]\s*(?=[^\d\s.,+])/g;

/**
 * Several priced items on one line become one expense for their total, with the
 * item names as the note. It stays low confidence, so the AI can split it when it
 * is on; offline nothing typed is dropped. Null unless every item has a price.
 */
export function parseMoneyList(
  text: string,
  context: QuickAddContext,
  forced?: "expense" | "income",
): MoneyDraft | null {
  // Split on an ASCII-digit copy (same length) so "২০, সিঙ্গারা" is seen as a number.
  const ascii = toAsciiDigits(text);
  const parts: string[] = [];
  let start = 0;
  for (const match of ascii.matchAll(ITEM_SEPARATOR_RE)) {
    if (match.index === 0) continue;
    parts.push(text.slice(start, match.index));
    start = match.index + match[0].length;
  }
  if (parts.length === 0) return null;
  parts.push(text.slice(start));
  const items = parts.map((part) => parseMoney(part, context, forced));
  const priced = items.filter(
    (item): item is MoneyDraft & { amountMinor: number } => item?.amountMinor != null,
  );
  if (priced.length !== items.length || new Set(priced.map((i) => i.kind)).size !== 1) return null;
  const [first] = priced;
  if (!first) return null;
  const named = priced.find((item) => item.accountId !== context.defaultAccountId);
  const categories = new Set(priced.map((item) => item.categoryId));
  return {
    ...first,
    amountMinor: priced.reduce((sum, item) => sum + item.amountMinor, 0),
    accountId: named?.accountId ?? first.accountId,
    categoryId: categories.size === 1 ? first.categoryId : null,
    areaId: priced.find((item) => item.areaId !== null)?.areaId ?? null,
    note: priced
      .map((item) => item.note)
      .filter(Boolean)
      .join(", "),
    confidence: "low",
  };
}

function addDaysToInstant(ms: number, days: number, timeZone: string): number {
  const localDate = addDays(toLocalDate(ms, timeZone), days);
  return startOfLocalDay(localDate, timeZone) + 12 * 60 * MINUTE_MS;
}
