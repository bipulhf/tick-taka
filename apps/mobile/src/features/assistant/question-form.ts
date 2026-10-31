import { type AssistantQuestion, assistantQuestionSchema } from "@tick-taka/shared/schemas/ai";
import {
  type AssistantAnswers,
  type AssistantPickerType,
  answerText,
} from "@tick-taka/shared/tiki-answers";
import type { ChatMessage } from "./chat-store";

/**
 * Tiki's questions as small forms (`done.question`, docs/TIKI_V2.md §11): which one
 * can still be answered, what the form starts with, and the message its answers
 * become. Pure, so it can be tested.
 */

/** A question from the server, kept only when it is a form this app can show. */
export function parseQuestion(raw: unknown): AssistantQuestion | undefined {
  if (raw === null || raw === undefined) return undefined;
  const parsed = assistantQuestionSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

/** The form's starting values: what Tiki already knows, from each field's default. */
export function initialAnswers(question: AssistantQuestion): AssistantAnswers {
  return Object.fromEntries(
    question.fields.flatMap((field) =>
      field.default === undefined ? [] : [[field.key, field.default]],
    ),
  );
}

/**
 * The message whose question can still be answered, or null. It is Tiki's latest
 * reply when that reply asks one and nothing came after it. A turn that failed (the
 * user's message and the error under it) doesn't count, so a form sent while the
 * connection dropped comes back with its answers to send again.
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

/** A record the user can pick in a form, as the app's own lists have it. */
export interface PickableRecord {
  id: string;
  name: string;
}

/** The user's records by picker type, to name picks in the message. */
export type FormRecords = Record<AssistantPickerType, readonly PickableRecord[]>;

/**
 * The message a filled form sends: `answerText` with picked records named from the
 * app's lists and amounts in the user's currency.
 */
export function formAnswer(
  question: AssistantQuestion,
  values: AssistantAnswers,
  { currency, records }: { currency?: string; records: FormRecords },
): string {
  return answerText(question, values, {
    currency,
    nameOf: (type, id) => records[type].find((record) => record.id === id)?.name,
  });
}

const ID_TAG = / \[id [0-9A-HJKMNP-TV-Z]{26}\]/g;

/**
 * A sent answer as the user reads it: the record ids the model needs are hidden
 * ("Account: Cash [id 01J…]" shows as "Account: Cash"). Other text is unchanged.
 */
export function readableMessage(content: string): string {
  return content.replace(ID_TAG, "");
}
