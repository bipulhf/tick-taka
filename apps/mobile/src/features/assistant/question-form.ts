import { type AssistantQuestion, assistantQuestionSchema } from "@tick-taka/shared/schemas/ai";

/**
 * Tiki's questions as small forms (`done.question`, docs/TIKI_V2.md §11). Pure, so
 * it can be tested.
 */

/** A question from the server, kept only when it is a form this app can show. */
export function parseQuestion(raw: unknown): AssistantQuestion | undefined {
  if (raw === null || raw === undefined) return undefined;
  const parsed = assistantQuestionSchema.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}
