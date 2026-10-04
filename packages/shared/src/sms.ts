/**
 * SMS auto-capture logic that runs on the phone: sender filtering, per-sender
 * templates built from 2–3 pasted sample messages, parsing, masking for the AI
 * fallback and fingerprinting so a message is never offered twice.
 */

import { DEFAULT_CURRENCY, toMinor } from "./money";

export type SmsDirection = "in" | "out" | "cash_out";

export interface ParsedSms {
  amountMinor: number;
  direction: SmsDirection;
  feeMinor: number;
  balanceAfterMinor: number | null;
  transactionRef: string | null;
  counterparty: string | null;
}

export interface SmsTemplate {
  /** Regular expression source with capture groups. */
  pattern: string;
  /** Role of each capture group, in order. */
  roles: FieldRole[];
  direction: SmsDirection;
}

export type FieldRole = "amount" | "fee" | "balance" | "ref" | "party" | "skip";

const BLOCK_RE = /\b(otp|code|pin|password|verification)\b/i;

/** Messages containing OTPs, codes or PINs are ignored outright. */
export function isBlockedMessage(body: string): boolean {
  return BLOCK_RE.test(body);
}

export function normalizeSender(sender: string): string {
  return sender
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function isAllowedSender(sender: string, allowed: string[]): boolean {
  const normalized = normalizeSender(sender);
  return allowed.some((s) => normalizeSender(s) === normalized);
}

const normalizeBody = (body: string) => body.replace(/\s+/g, " ").trim();

export function detectDirection(body: string): SmsDirection | null {
  const text = body.toLowerCase();
  if (/\bcash\s*-?\s*out\b/.test(text)) return "cash_out";
  if (/\b(received|cash\s*-?\s*in|credited|deposited|deposit|refund|added to)\b/.test(text))
    return "in";
  if (
    /\b(payment|paid|send money|sent|purchase|debited|withdrawn|withdrawal|transferred|spent|bill pay)\b/.test(
      text,
    )
  ) {
    return "out";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Field detection shared by template building and the generic parser.
// ---------------------------------------------------------------------------

interface Span {
  start: number;
  end: number;
  kind: "money" | "phone" | "ref" | "datetime" | "account" | "party";
  role: FieldRole;
}

const MONEY_RE =
  /(?:tk\.?|bdt|৳|taka|amount:?)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:tk|bdt|taka)\b/gi;
const PHONE_RE = /(?:\+?88)?01[3-9]\d{8}\b/g;
const REF_RE =
  /\b(?:trx\s*id|txn\s*id|trxid|txnid|transaction\s*id|ref(?:erence)?(?:\s*no)?)[:.]?\s*([A-Z0-9]{5,})\b/gi;
const DATETIME_RE =
  /\b\d{1,2}[/-](?:\d{1,2}|[A-Za-z]{3})[/-]\d{2,4}(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?|\b\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?\b/gi;
const ACCOUNT_RE =
  /\b(?:a\/c|acct?|account|card)(?:\s*no\.?)?[:\s]*([*xX]+\d{2,6}|\d{2,6}[*xX]+\d*)/gi;
const PARTY_RE =
  /\b(?:to|from|sender:?|receiver:?|at merchant|merchant:?)\s+((?:[A-Z][\w&.'-]*\s?){1,4}?)(?=\s*(?:successful|is successful|\.|,|fee|balance|on\s|at\s|ref|trx|txn|$))/g;

function roleForMoney(body: string, start: number, alreadyHasAmount: boolean): FieldRole {
  const window = body.slice(Math.max(0, start - 24), start).toLowerCase();
  if (/(fee|charge|vat)\W*$/.test(window) || /(fee|charge)[^.]{0,8}$/.test(window)) return "fee";
  if (/(balance|bal|avl\.?\s*bal)[^.]{0,10}$/.test(window)) return "balance";
  return alreadyHasAmount ? "skip" : "amount";
}

function overlaps(spans: Span[], start: number, end: number): boolean {
  return spans.some((s) => start < s.end && end > s.start);
}

function findSpans(body: string): Span[] {
  const spans: Span[] = [];
  const add = (
    regex: RegExp,
    kind: Span["kind"],
    group: number,
    role: (start: number) => FieldRole,
  ) => {
    regex.lastIndex = 0;
    for (let m = regex.exec(body); m; m = regex.exec(body)) {
      const value = m[group] ?? m[0];
      const start = m.index + m[0].lastIndexOf(value);
      const end = start + value.length;
      if (!overlaps(spans, start, end)) spans.push({ start, end, kind, role: role(start) });
    }
  };
  add(REF_RE, "ref", 1, () => "ref");
  add(DATETIME_RE, "datetime", 0, () => "skip");
  add(ACCOUNT_RE, "account", 1, () => "skip");
  add(PHONE_RE, "phone", 0, (start) =>
    /(to|from|sender:?|receiver:?)\s*$/i.test(body.slice(0, start)) ? "party" : "skip",
  );
  // Money: find all then assign roles in text order.
  MONEY_RE.lastIndex = 0;
  const money: Span[] = [];
  for (let m = MONEY_RE.exec(body); m; m = MONEY_RE.exec(body)) {
    const value = m[1] ?? m[2]!;
    const start = m.index + m[0].indexOf(value);
    const end = start + value.length;
    if (!overlaps(spans, start, end)) money.push({ start, end, kind: "money", role: "skip" });
  }
  let hasAmount = false;
  for (const span of money.sort((a, b) => a.start - b.start)) {
    span.role = roleForMoney(body, span.start, hasAmount);
    if (span.role === "amount") hasAmount = true;
    spans.push(span);
  }
  add(PARTY_RE, "party", 1, () => "party");
  return spans.sort((a, b) => a.start - b.start);
}

const toMinorFromText = (value: string, currency: string) =>
  toMinor(Number(value.replace(/,/g, "")), currency);

/** Template-free extraction, used to label fields while building templates. */
export function genericParse(body: string, currency: string = DEFAULT_CURRENCY): ParsedSms | null {
  const text = normalizeBody(body);
  const direction = detectDirection(text);
  if (!direction) return null;
  const spans = findSpans(text);
  const value = (role: FieldRole) => {
    const span = spans.find((s) => s.role === role);
    return span ? text.slice(span.start, span.end).trim() : null;
  };
  const amount = value("amount");
  if (!amount) return null;
  const fee = value("fee");
  const balance = value("balance");
  return {
    amountMinor: toMinorFromText(amount, currency),
    direction,
    feeMinor: fee ? toMinorFromText(fee, currency) : 0,
    balanceAfterMinor: balance ? toMinorFromText(balance, currency) : null,
    transactionRef: value("ref"),
    counterparty: value("party"),
  };
}

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const GROUP_FOR_KIND: Record<Span["kind"], string> = {
  money: String.raw`([\d,]+(?:\.\d{1,2})?)`,
  phone: String.raw`((?:\+?88)?01\d{9})`,
  ref: "([A-Za-z0-9]+)",
  datetime: "(.+?)",
  account: String.raw`(\S+)`,
  party: "(.+?)",
};

/**
 * Builds a template from one real sample message. Variable parts (amounts, phone
 * numbers, IDs, dates, names) become capture groups; the fixed wording stays literal.
 * Returns null when the sample has no recognisable amount or direction.
 */
export function buildTemplate(sample: string): SmsTemplate | null {
  const text = normalizeBody(sample);
  const direction = detectDirection(text);
  if (!direction) return null;
  const spans = findSpans(text);
  if (!spans.some((s) => s.role === "amount")) return null;
  let pattern = "^";
  let cursor = 0;
  const roles: FieldRole[] = [];
  for (const span of spans) {
    pattern += escapeRegex(text.slice(cursor, span.start)).replace(/ /g, String.raw`\s+`);
    pattern += GROUP_FOR_KIND[span.kind];
    roles.push(span.role);
    cursor = span.end;
  }
  pattern += `${escapeRegex(text.slice(cursor)).replace(/ /g, String.raw`\s+`)}$`;
  return { pattern, roles, direction };
}

/** Builds templates from several samples, skipping ones that don't parse. */
export function buildTemplates(samples: string[]): SmsTemplate[] {
  const templates: SmsTemplate[] = [];
  for (const sample of samples) {
    const template = buildTemplate(sample);
    if (template && !templates.some((t) => t.pattern === template.pattern))
      templates.push(template);
  }
  return templates;
}

export function parseWithTemplates(
  body: string,
  templates: SmsTemplate[],
  currency: string = DEFAULT_CURRENCY,
): ParsedSms | null {
  const text = normalizeBody(body);
  for (const template of templates) {
    const match = new RegExp(template.pattern, "i").exec(text);
    if (!match) continue;
    const field = (role: FieldRole) => {
      const index = template.roles.indexOf(role);
      return index >= 0 ? (match[index + 1] ?? null) : null;
    };
    const amount = field("amount");
    if (!amount) continue;
    const fee = field("fee");
    const balance = field("balance");
    return {
      amountMinor: toMinorFromText(amount, currency),
      direction: template.direction,
      feeMinor: fee ? toMinorFromText(fee, currency) : 0,
      balanceAfterMinor: balance ? toMinorFromText(balance, currency) : null,
      transactionRef: field("ref"),
      counterparty: field("party")?.trim() ?? null,
    };
  }
  return null;
}

/**
 * Masks private details before the AI fallback: phone numbers, account numbers and
 * names after "to"/"from" are replaced; amounts stay so the reply is useful.
 */
export function maskSms(body: string): string {
  return normalizeBody(body)
    .replace(PHONE_RE, "[PHONE]")
    .replace(ACCOUNT_RE, (m, account: string) => m.replace(account, "[ACCOUNT]"))
    .replace(
      /\b(to|from|sender:?|receiver:?)\s+((?:[A-Z][a-z]+\s?){1,3})/g,
      (_m, label: string) => `${label} [NAME] `,
    )
    .replace(/\b\d{6,}\b/g, "[NUMBER]")
    .replace(/\s+/g, " ")
    .trim();
}

/** 32-bit FNV-1a hash, hex encoded. */
export function fnv1a(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Fingerprint by transaction ID, or by sender + minute + amount when there is no ID.
 */
export function smsFingerprint(input: {
  sender: string;
  receivedAt: number;
  amountMinor: number;
  transactionRef: string | null;
}): string {
  const sender = normalizeSender(input.sender);
  if (input.transactionRef) return `${sender}:ref:${input.transactionRef.toUpperCase()}`;
  const minute = Math.floor(input.receivedAt / 60_000);
  return `${sender}:h:${fnv1a(`${minute}:${input.amountMinor}`)}`;
}
