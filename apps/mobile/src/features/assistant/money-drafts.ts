import { z } from "zod";
import type { OutboxRequest } from "@/lib/outbox-policy";

/**
 * Money changes Tiki proposes instead of making (the chat asks with
 * `draftMoney: true`): nothing is saved until the user taps Save, and then the
 * phone sends exactly the proposed request through the outbox. Ids are already
 * in the body, so a retry never doubles a transaction. Pure, so it can be tested.
 */

const undoSchema = z.object({
  method: z.enum(["POST", "PATCH", "PUT", "DELETE"]),
  path: z.string(),
  body: z.record(z.string(), z.unknown()).optional(),
});

const draftSchema = z.object({
  summary: z.string(),
  method: z.enum(["POST", "PATCH", "PUT"]),
  path: z.string().startsWith("/"),
  body: z.record(z.string(), z.unknown()),
  undo: undoSchema.optional(),
});

export type MoneyDraft = z.infer<typeof draftSchema>;

/** A proposed change in the chat and what the user did with it. */
export interface ChatDraft extends MoneyDraft {
  state: "pending" | "saved" | "discarded";
}

/** The well-formed drafts of a `done` event; anything malformed is dropped. */
export function parseDrafts(raw: unknown): ChatDraft[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = draftSchema.safeParse(item);
    return parsed.success ? [{ ...parsed.data, state: "pending" as const }] : [];
  });
}

/** The write Save sends: exactly the proposal, with the edit time on a PATCH. */
export function draftRequest(draft: MoneyDraft, updatedAt: number): OutboxRequest {
  return {
    method: draft.method,
    path: draft.path,
    body: draft.method === "PATCH" ? { ...draft.body, updatedAt } : draft.body,
    label: `Couldn't save: ${draft.summary}`,
  };
}

const AMOUNT_FIELDS = ["amountMinor", "principalMinor", "openingBalanceMinor", "balanceMinor"];

export interface DraftView {
  title: string;
  /** Signed: money out is negative, money in positive; null when the draft has no amount. */
  amountMinor: number | null;
  signed: boolean;
  account: string | null;
  category: string | null;
  date: number | null;
}

/** What the card shows: amount with its sign, account, category and date, by name. */
export function draftView(
  draft: MoneyDraft,
  lookup: {
    accounts: { id: string; name: string }[];
    categories: { id: string; name: string; emoji?: string }[];
  },
): DraftView {
  const body = draft.body;
  const field = AMOUNT_FIELDS.find((key) => typeof body[key] === "number");
  const raw = field ? Math.abs(body[field] as number) : null;
  const type = body.type;
  const amountMinor = raw !== null && type === "expense" ? -raw : raw;
  const accountId = typeof body.accountId === "string" ? body.accountId : null;
  const categoryId = typeof body.categoryId === "string" ? body.categoryId : null;
  const category = lookup.categories.find((c) => c.id === categoryId);
  return {
    title: draft.summary,
    amountMinor,
    signed: type === "expense" || type === "income",
    account: lookup.accounts.find((a) => a.id === accountId)?.name ?? null,
    category: category ? `${category.emoji ? `${category.emoji} ` : ""}${category.name}` : null,
    date: typeof body.occurredAt === "number" ? body.occurredAt : null,
  };
}
