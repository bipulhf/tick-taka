import { toMinor } from "@tick-taka/shared/money";
import {
  ASSISTANT_FIELD_TYPES,
  type AssistantQuestion,
  assistantQuestionSchema,
} from "@tick-taka/shared/schemas/ai";
import type { AiToolDefinition } from "../../../ai/client";
import { findByName, type Vocabulary } from "../context";
import { isId } from "./records";

const nullable = (type: string, description: string) => ({ type: [type, "null"], description });

/**
 * `ask` (TIKI_V2 §11): Tiki's question as a small form. Strict mode sends every
 * property, so optional ones are null here and dropped before the shared Zod
 * schema checks them. Limits are in the descriptions; Zod enforces them.
 */
export const QUESTION_TOOL: AiToolDefinition = {
  name: "ask",
  description: [
    "Ask the user with a small form when only they can give something (a missing name, amount, date, which account, or whether to go ahead). Your turn ends when this works: the question is your reply, so do not also write it out. At most once per message.",
    "Write the question, labels and option labels in the language of the user's latest message (an English message gets English, even about Bangla words like Nagad).",
    "1 to 6 fields, only what is missing: leave out anything the user already said (\"my Nagad wallet\" gives the name Nagad and the type mobile wallet). Field types: choice (options: 2 to 8 {value, label}, one pick), text (up to 80 characters), amount, date (YYYY-MM-DD), time (HH:MM), account, category, area (pickers over the user's own records; a category's options may be one option with value expense or income to narrow it). Other types get options null.",
    "A single choice field is a quick reply (tapping an option sends it): use it for yes/no and either/or questions.",
    "default prefills a field with what the user already said or a sensible default: an option value, the text, the amount in taka (major units), a date, a time, or the name of an account, category or area.",
  ].join("\n"),
  parameters: {
    type: "object",
    properties: {
      question: {
        type: "string",
        description:
          "The question, at most 160 characters, in the language of the user's latest message",
      },
      fields: {
        type: "array",
        description: "1 to 6 fields",
        items: {
          type: "object",
          properties: {
            key: {
              type: "string",
              description: "Short word naming the field, like openingBalance",
            },
            label: { type: "string", description: "What the user sees, at most 40 characters" },
            type: { type: "string", enum: ASSISTANT_FIELD_TYPES },
            required: nullable("boolean", "true when the user must fill it"),
            default: {
              type: ["string", "number", "null"],
              description: "Prefilled value, or null",
            },
            placeholder: nullable("string", "Hint inside an empty field, or null"),
            options: {
              type: ["array", "null"],
              items: {
                type: "object",
                properties: {
                  value: { type: "string" },
                  label: { type: "string", description: "At most 40 characters" },
                },
                required: ["value", "label"],
                additionalProperties: false,
              },
            },
          },
          required: ["key", "label", "type", "required", "default", "placeholder", "options"],
          additionalProperties: false,
        },
      },
      submitLabel: nullable("string", "Send button text, at most 24 characters, or null"),
    },
    required: ["question", "fields", "submitLabel"],
    additionalProperties: false,
  },
};

/** Null means absent: strict mode sends every property. */
function withoutNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, inner]) => inner !== null)
      .map(([key, inner]) => [key, withoutNulls(inner)]),
  );
}

/**
 * The model speaks taka and names, the form holds minor units and ids. A picker
 * default naming no record of the user's is dropped: it is only a prefill.
 */
function toFormValues(
  field: Record<string, unknown>,
  vocab: Vocabulary,
  currency: string,
): Record<string, unknown> {
  if (Array.isArray(field.options) && field.options.length === 0) {
    const { options: _, ...rest } = field;
    return toFormValues(rest, vocab, currency);
  }
  const value = field.default;
  if (field.type === "amount" && typeof value === "number")
    return { ...field, default: toMinor(value, currency) };
  if (!["account", "category", "area"].includes(String(field.type))) return field;
  if (typeof value !== "string" || isId(value)) return field;
  const kind = (field.options as { value?: unknown }[] | undefined)?.[0]?.value;
  const records =
    field.type === "account"
      ? vocab.accounts
      : field.type === "area"
        ? vocab.areas
        : vocab.categories.filter((category) => kind === undefined || category.kind === kind);
  const id = findByName(records, value)?.id;
  const { default: _, ...rest } = field;
  return id ? { ...rest, default: id } : rest;
}

/**
 * Reads the model's `ask` arguments into the shared question, or an error the
 * model can fix and call again with.
 */
export function readQuestion(
  rawArgs: string,
  context: { vocab: Vocabulary; currency: string },
): { question: AssistantQuestion } | { error: string } {
  let args: unknown;
  try {
    args = withoutNulls(JSON.parse(rawArgs || "{}"));
  } catch {
    return { error: "ask arguments must be a JSON object" };
  }
  const fields = (args as { fields?: unknown } | null)?.fields;
  const input = Array.isArray(fields)
    ? {
        ...(args as object),
        fields: fields.map((field) =>
          field && typeof field === "object"
            ? toFormValues(field as Record<string, unknown>, context.vocab, context.currency)
            : field,
        ),
      }
    : args;
  const parsed = assistantQuestionSchema.safeParse(input);
  if (parsed.success) return { question: parsed.data };
  const problems = parsed.error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join(".") || "ask"}: ${issue.message}`);
  return { error: `The form isn't valid, fix it and call ask again. ${problems.join("; ")}` };
}

/**
 * For the memo: the question and its fields, so the next message ("Label: value"
 * lines) reads as answers to it when the app sends the chat back.
 */
export function describeQuestion(question: AssistantQuestion): string {
  const fields = question.fields.map((field) => {
    const options =
      field.type === "choice"
        ? ` ${field.options.map((option) => option.label).join("|")}`
        : field.type === "category" && field.options
          ? ` ${field.options[0]?.value}`
          : "";
    return `${field.label} (${field.type}${options}${field.required ? ", required" : ""})`;
  });
  return `asked the user with a form: “${question.question}” fields ${fields.join(", ")}; their next message answers it`;
}
