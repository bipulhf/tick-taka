import { toBanglaDigits } from "@tick-taka/shared/digits";
import { type Numerals, toMajor } from "@tick-taka/shared/money";
import { type AssistantQuestion, assistantQuestionSchema } from "@tick-taka/shared/schemas/ai";
import {
  type AnswerLookups,
  type AssistantAnswers,
  answerText,
  missingRequired,
} from "@tick-taka/shared/tiki-answers";
import { readAmount } from "../money/amount-text";
import type { ChatMessage } from "./chat-store";

/**
 * Tiki's question as a small form (`done.question`): what the form holds while it is
 * filled in, and the message it sends. Pure, so it can be tested.
 */

/**
 * The form as typed, by field key: an option's value, the typed text or amount,
 * YYYY-MM-DD, HH:MM or a record id. Empty means not answered.
 */
export type QuestionFormState = Record<string, string>;

/** A question from the server, or nothing when it is missing or doesn't read as one. */
export function parseQuestion(raw: unknown): AssistantQuestion | undefined {
  if (raw === null || raw === undefined) return undefined;
  const parsed = assistantQuestionSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The form prefilled with each field's default; amounts in major units and the user's digits. */
export function initialFormState(
  question: AssistantQuestion,
  { currency, numerals = "latn" }: { currency: string; numerals?: Numerals },
): QuestionFormState {
  return Object.fromEntries(
    question.fields.map((field) => {
      if (field.default === undefined) return [field.key, ""];
      if (field.type !== "amount") return [field.key, String(field.default)];
      const major = String(toMajor(field.default, currency));
      return [field.key, numerals === "beng" ? toBanglaDigits(major) : major];
    }),
  );
}

/** The form's values as answers: amounts read as minor units (sums work), null when unreadable. */
export function formAnswers(
  question: AssistantQuestion,
  state: QuestionFormState,
  currency: string,
): AssistantAnswers {
  return Object.fromEntries(
    question.fields.map((field) => {
      const text = state[field.key] ?? "";
      if (field.type !== "amount") return [field.key, text];
      return [field.key, text.trim() ? readAmount(text, currency) : null];
    }),
  );
}

/** Keys of amount fields holding text that doesn't read as an amount. */
export function unreadableAmounts(
  question: AssistantQuestion,
  state: QuestionFormState,
  currency: string,
): string[] {
  return question.fields
    .filter(
      (field) =>
        field.type === "amount" &&
        (state[field.key] ?? "").trim() !== "" &&
        readAmount(state[field.key] ?? "", currency) === null,
    )
    .map((field) => field.key);
}

/** Keys of the fields that keep Send waiting (empty required or unreadable amounts), in form order. */
export function blockingFields(
  question: AssistantQuestion,
  state: QuestionFormState,
  currency: string,
): string[] {
  const blocked = new Set([
    ...missingRequired(question, formAnswers(question, state, currency)),
    ...unreadableAmounts(question, state, currency),
  ]);
  return question.fields.filter((field) => blocked.has(field.key)).map((field) => field.key);
}

/** The user message a filled form sends, one `Label: value` line per answered field. */
export function formMessage(
  question: AssistantQuestion,
  state: QuestionFormState,
  lookups: AnswerLookups & { currency: string },
): string {
  return answerText(question, formAnswers(question, state, lookups.currency), lookups);
}

/** What a quick reply sends when one of its options is clicked: the option's label. */
export function quickReplyMessage(question: AssistantQuestion, value: string): string {
  const key = question.fields[0]?.key;
  return key ? answerText(question, { [key]: value }) : "";
}

/**
 * The one message whose question can still be answered: Tiki's latest reply, when it
 * asks one and nothing came after it. Any later message (an answer, or the user
 * typing instead) counts as answering it, except a turn that failed (the user's
 * message and the error under it), so a form sent as the connection dropped comes
 * back to send again.
 */
export function openQuestionId(messages: readonly ChatMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (!message || message.failed) continue;
    if (message.role === "user") {
      if (messages[i + 1]?.failed) continue;
      return null;
    }
    return message.question ? message.id : null;
  }
  return null;
}

const ID_TAG = / \[id [0-9A-HJKMNP-TV-Z]{26}\]/g;

/**
 * A sent answer as the user reads it: the record ids the model needs are hidden
 * ("Account: Cash [id 01J…]" shows as "Account: Cash"). Other text is unchanged.
 */
export function readableMessage(content: string): string {
  return content.replace(ID_TAG, "");
}
