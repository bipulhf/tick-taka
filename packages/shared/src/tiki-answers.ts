/**
 * Turning the answers to one of Tiki's small forms (`done.question`) into the next
 * user message, the same way on the web and the phone. The model reads that
 * message like any other, so values are plain and machine readable: Latin digits,
 * amounts in major units with the currency code, record picks with their id.
 */

import { toAsciiDigits } from "./digits";
import { DEFAULT_CURRENCY, minorDigits } from "./money";
import type { AssistantQuestion, AssistantQuestionField } from "./schemas/ai";

/**
 * One field's value as the form holds it: the option's value (choice), minor units
 * (amount), YYYY-MM-DD (date), HH:MM (time), a record id (account, category, area)
 * or the typed text. Empty, null or absent means not answered.
 */
export type AssistantAnswerValue = string | number | null | undefined;
/** The form's values by field key. */
export type AssistantAnswers = Record<string, AssistantAnswerValue>;

export type AssistantPickerType = "account" | "category" | "area";

export interface AnswerLookups {
  /** The user's currency for amounts; BDT when absent. */
  currency?: string;
  /** The name of a picked record, from the app's own lists. */
  nameOf?: (type: AssistantPickerType, id: string) => string | undefined;
}

/** A form that is a single choice field: tapping an option sends it at once. */
export function isQuickReply(question: AssistantQuestion): boolean {
  return question.fields.length === 1 && question.fields[0]?.type === "choice";
}

const oneLine = (text: string) => text.replace(/\s+/g, " ").trim();

/** Whether a value counts as given: not empty, not just spaces, not NaN. */
export function isAnswered(value: AssistantAnswerValue): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  return value.trim() !== "";
}

/** Keys of the required fields still empty, in form order. Send waits until it is []. */
export function missingRequired(question: AssistantQuestion, values: AssistantAnswers): string[] {
  return question.fields
    .filter((field) => field.required === true && !isAnswered(values[field.key]))
    .map((field) => field.key);
}

/** Minor units as major units: 500000 BDT → "5000", 61667 → "616.67", -2050 → "-20.50". */
function majorText(minor: number, currency: string): string {
  const digits = minorDigits(currency);
  const factor = 10 ** digits;
  const abs = Math.abs(Math.trunc(minor));
  const whole = Math.floor(abs / factor);
  const fraction = abs % factor;
  const sign = minor < 0 && abs > 0 ? "-" : "";
  return `${sign}${whole}${fraction ? `.${String(fraction).padStart(digits, "0")}` : ""}`;
}

/** One field's answer as text, or null when it was skipped. */
export function answerValue(
  field: AssistantQuestionField,
  value: AssistantAnswerValue,
  lookups: AnswerLookups = {},
): string | null {
  if (!isAnswered(value)) return null;
  const raw = oneLine(toAsciiDigits(String(value)));
  switch (field.type) {
    case "choice":
      return field.options.find((option) => option.value === raw)?.label ?? raw;
    case "amount": {
      const minor = typeof value === "number" ? value : Number(raw.replace(/,/g, ""));
      if (!Number.isFinite(minor)) return null;
      const currency = (lookups.currency ?? DEFAULT_CURRENCY).toUpperCase();
      return `${majorText(minor, currency)} ${currency}`;
    }
    case "account":
    case "category":
    case "area": {
      const name = lookups.nameOf?.(field.type, raw);
      return name ? `${oneLine(name)} [id ${raw}]` : `[id ${raw}]`;
    }
    case "text":
      // The user's own words stay as typed, on one line.
      return oneLine(String(value));
    default:
      return raw;
  }
}

/**
 * The message the app sends for a filled form: one `Label: value` line per answered
 * field, in form order ("Name: bKash\nOpening balance: 5000 BDT"). Skipped optional
 * fields are left out. A quick reply sends just the picked option's label.
 */
export function answerText(
  question: AssistantQuestion,
  values: AssistantAnswers,
  lookups: AnswerLookups = {},
): string {
  if (isQuickReply(question)) {
    const [field] = question.fields;
    return field ? (answerValue(field, values[field.key], lookups) ?? "") : "";
  }
  return question.fields
    .flatMap((field) => {
      const text = answerValue(field, values[field.key], lookups);
      return text === null ? [] : [`${field.label}: ${text}`];
    })
    .join("\n");
}
