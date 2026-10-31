/**
 * Request bodies for /ai/* and the Structured Outputs the model must return.
 * Output schemas use nullable (never optional) fields because strict JSON-schema
 * mode requires every property to be present.
 */

import { z } from "zod";
import { idSchema, localDateSchema, localMonthSchema } from "./common";

// Requests --------------------------------------------------------------------
export const aiParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(1000),
  kind: z.enum(["expense", "income", "task", "time_entry"]).optional(),
});
export const aiReceiptRequestSchema = z.object({
  imageBase64: z.string().min(100).max(8_000_000),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});
export const aiPlanDayRequestSchema = z.object({ date: localDateSchema });
export const aiBreakdownRequestSchema = z.object({
  taskId: idSchema.optional(),
  title: z.string().trim().min(1).max(300),
  notes: z.string().max(2000).optional(),
});
export const aiWeeklyReviewRequestSchema = z.object({ weekStart: localDateSchema.optional() });
export const aiBudgetSuggestionsRequestSchema = z.object({ month: localMonthSchema });

// Structured outputs ----------------------------------------------------------
const nullableString = z.string().nullable();

export const aiParseOutputSchema = z.object({
  kind: z.enum(["expense", "income", "transfer", "task", "time_entry"]),
  title: nullableString.describe("Task title, without dates or recurrence words"),
  amount: z.number().nullable().describe("Amount in major units, e.g. 250 for ৳250"),
  fee: z.number().nullable().describe("Fee or charge in major units, if any"),
  accountName: nullableString.describe("One of the provided account names, or null"),
  toAccountName: nullableString.describe("For transfers: destination account name, or null"),
  categoryName: nullableString.describe("One of the provided category names, or null"),
  areaName: nullableString.describe("One of the provided area names, or null"),
  note: nullableString.describe("Short note: merchant or person"),
  date: nullableString.describe("Local date YYYY-MM-DD, or null for today"),
  time: nullableString.describe("Local time HH:MM in 24h, or null"),
  minutes: z.number().nullable().describe("Duration in minutes for time entries"),
  deadline: nullableString.describe("Deadline as YYYY-MM-DD, or null"),
  recurrence: nullableString.describe(
    "Repeat rule in plain English, e.g. 'every month on the 5th'",
  ),
  priority: z.enum(["low", "normal", "high"]).nullable(),
  whenSlot: z.enum(["day", "evening"]).nullable(),
});
export type AiParseOutput = z.infer<typeof aiParseOutputSchema>;

export const aiReceiptOutputSchema = z.object({
  merchant: nullableString,
  total: z.number().nullable().describe("Grand total in major units"),
  date: nullableString.describe("YYYY-MM-DD"),
  categoryName: nullableString.describe("One of the provided category names, or null"),
  items: z.array(z.object({ name: z.string(), price: z.number().nullable() })),
});
export type AiReceiptOutput = z.infer<typeof aiReceiptOutputSchema>;

export const aiPlanDayOutputSchema = z.object({
  blocks: z.array(
    z.object({
      taskId: nullableString.describe("ID of the task this block is for, or null"),
      title: z.string(),
      start: z.string().describe("HH:MM local"),
      end: z.string().describe("HH:MM local"),
      kind: z.enum(["task", "bill", "break", "fixed"]),
    }),
  ),
  note: z.string().describe("One short friendly sentence about the plan"),
});
export type AiPlanDayOutput = z.infer<typeof aiPlanDayOutputSchema>;

export const aiBreakdownOutputSchema = z.object({
  subtasks: z.array(z.string()).describe("3 to 7 concrete, startable subtasks"),
});

export const aiWeeklyReviewOutputSchema = z.object({
  observations: z.array(z.string()).describe("Exactly three short observations"),
  suggestion: z.string().describe("One kind, concrete suggestion for next week"),
});
export type AiWeeklyReviewOutput = z.infer<typeof aiWeeklyReviewOutputSchema>;

export const aiBudgetSuggestionsOutputSchema = z.object({
  budgets: z.array(
    z.object({
      categoryName: z.string(),
      limit: z.number().describe("Monthly limit in major units"),
      reason: z.string(),
    }),
  ),
});
export type AiBudgetSuggestionsOutput = z.infer<typeof aiBudgetSuggestionsOutputSchema>;

// Assistant chat -----------------------------------------------------------------
export const assistantMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(4000),
  /** What the assistant changed in that turn, with ids, so follow-ups like "move it" work. */
  memo: z.string().max(4000).optional(),
});

/** Kinds of record the app can show the assistant (`screen.record`) and Tiki can link to (cards). */
export const ASSISTANT_RECORD_KINDS = [
  "task",
  "transaction",
  "habit",
  "goal",
  "debt",
  "account",
  "event",
  "project",
  "recurring",
  "shopping_item",
  "time_entry",
  "routine",
] as const;
export type AssistantRecordKind = (typeof ASSISTANT_RECORD_KINDS)[number];

/** What the user is looking at: the route, and the record open in a panel or sheet. */
export const assistantScreenSchema = z.object({
  view: z.string().max(120),
  record: z.object({ kind: z.enum(ASSISTANT_RECORD_KINDS), id: idSchema }).optional(),
});
export type AssistantScreen = z.infer<typeof assistantScreenSchema>;

export const assistantRequestSchema = z.object({
  messages: z.array(assistantMessageSchema).min(1).max(30),
  /**
   * The phone can confirm drafts: money changes (transactions, balances, bills
   * paid, goal contributions, debt repayments, shopping checkout) come back in
   * `done.drafts` for the user to confirm, instead of being saved.
   */
  draftMoney: z.boolean().optional(),
  /** The screen the message was sent from, so "this" and "here" mean something. */
  screen: assistantScreenSchema.optional(),
  /** The chat this turn belongs to (a ULID the app makes); with it the server keeps the chat. */
  threadId: idSchema.optional(),
});
export type AssistantMessage = z.infer<typeof assistantMessageSchema>;

/** Something in Tiki's answer the app can show as a tappable card (`done.cards`). */
export type AssistantCard =
  | {
      type: "record";
      kind: AssistantRecordKind;
      id: string;
      title: string;
      subtitle?: string;
    }
  | { type: "total"; label: string; amountMinor?: number; minutes?: number; count?: number };

export const ASSISTANT_RATINGS = ["up", "down"] as const;
export type AssistantRating = (typeof ASSISTANT_RATINGS)[number];

/** POST /ai/feedback: a thumbs up or down on a stored reply. */
export const assistantFeedbackSchema = z.object({
  messageId: idSchema,
  rating: z.enum(ASSISTANT_RATINGS),
  comment: z.string().trim().max(500).optional(),
});

/** PATCH /ai/threads/:id */
export const assistantThreadPatchSchema = z.object({ title: z.string().trim().min(1).max(60) });

export const VOICE_MIME_TYPES = [
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/mpeg",
  "audio/wav",
  "audio/webm",
  "audio/3gpp",
] as const;
/** A voice note for the assistant, up to about two minutes of compressed audio. */
export const aiTranscribeRequestSchema = z.object({
  audio: z.string().min(100).max(8_000_000),
  mimeType: z.enum(VOICE_MIME_TYPES),
});
