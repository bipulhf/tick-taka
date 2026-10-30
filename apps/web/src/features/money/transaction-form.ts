import { z } from "zod";
import { amountText, readAmount } from "./amount-text";

/** The transaction panel's form, its checks and what it sends. Pure, so it can be tested. */

export type TxType = "expense" | "income" | "transfer";
export type AnyTxType = TxType | "adjustment";

export const formSchema = z
  .object({
    type: z.enum(["expense", "income", "transfer", "adjustment"]),
    amountMinor: z.number().int().positive("Enter an amount"),
    toAmountMinor: z.number().int().positive().nullable(),
    feeMinor: z.number().int().nonnegative(),
    accountId: z.string().min(1, "Pick an account"),
    toAccountId: z.string().nullable(),
    categoryId: z.string().nullable(),
    areaId: z.string().nullable(),
    eventId: z.string().nullable(),
    note: z.string().max(2000),
    occurredAt: z.number().int(),
    receiptPath: z.string().nullable(),
  })
  .refine((v) => v.type !== "transfer" || (v.toAccountId && v.toAccountId !== v.accountId), {
    message: "Pick a different account to move money to",
    path: ["toAccountId"],
  });
export type Form = z.infer<typeof formSchema>;

/** What the panel edits: the amounts stay as typed (they may be sums) until saving. */
export interface Draft {
  type: AnyTxType;
  amount: string;
  toAmount: string;
  fee: string;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  areaId: string | null;
  eventId: string | null;
  note: string;
  occurredAt: number;
  receiptPath: string | null;
}

interface Stored {
  type: AnyTxType;
  amountMinor: number;
  toAmountMinor: number | null;
  feeMinor: number;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  areaId: string | null;
  eventId: string | null;
  note: string | null;
  occurredAt: number;
  receiptPath: string | null;
}

const PRESET_TYPES: AnyTxType[] = ["expense", "income", "transfer"];

/** A saved transaction as the panel's starting draft. */
export function draftFromTransaction(
  tx: Stored,
  currencyOf: (accountId: string | null) => string,
): Draft {
  return {
    type: tx.type,
    amount: amountText(Math.abs(tx.amountMinor), currencyOf(tx.accountId)),
    toAmount: amountText(tx.toAmountMinor, currencyOf(tx.toAccountId)),
    fee: amountText(tx.feeMinor, currencyOf(tx.accountId)),
    accountId: tx.accountId,
    toAccountId: tx.toAccountId,
    categoryId: tx.categoryId,
    areaId: tx.areaId,
    eventId: tx.eventId,
    note: tx.note ?? "",
    occurredAt: tx.occurredAt,
    receiptPath: tx.receiptPath,
  };
}

/**
 * A new transaction's draft from `?preset=` (type, amountMinor, note, categoryId,
 * accountId, toAccountId, occurredAt in epoch ms, receiptPath) over the defaults.
 */
export function draftFromPreset(
  preset: URLSearchParams,
  defaults: { accountId: string; now: number },
  currencyOf: (accountId: string | null) => string,
): Draft {
  const type = PRESET_TYPES.find((t) => t === preset.get("type")) ?? "expense";
  const accountId = preset.get("accountId") || defaults.accountId;
  const amountMinor = Number(preset.get("amountMinor"));
  const occurredAt = Number(preset.get("occurredAt"));
  return {
    type,
    amount:
      Number.isInteger(amountMinor) && amountMinor > 0
        ? amountText(amountMinor, currencyOf(accountId))
        : "",
    toAmount: "",
    fee: "",
    accountId,
    toAccountId: type === "transfer" ? preset.get("toAccountId") || null : null,
    categoryId: preset.get("categoryId") || null,
    areaId: null,
    eventId: null,
    note: preset.get("note") ?? "",
    occurredAt: Number.isInteger(occurredAt) && occurredAt > 0 ? occurredAt : defaults.now,
    receiptPath: preset.get("receiptPath") || null,
  };
}

/** The draft read into the form's numbers (an unreadable amount reads as 0, which the check refuses). */
export function formFromDraft(
  draft: Draft,
  currencies: { from: string; to: string },
  /** A balance check keeps its stored, signed amount. */
  adjustmentMinor?: number,
): Form {
  return {
    type: draft.type,
    amountMinor:
      draft.type === "adjustment" && adjustmentMinor !== undefined
        ? Math.abs(adjustmentMinor) || 1
        : (readAmount(draft.amount, currencies.from) ?? 0),
    toAmountMinor: positive(readAmount(draft.toAmount, currencies.to)),
    feeMinor: Math.max(0, readAmount(draft.fee, currencies.from) ?? 0),
    accountId: draft.accountId,
    toAccountId: draft.toAccountId,
    categoryId: draft.categoryId,
    areaId: draft.areaId,
    eventId: draft.eventId,
    note: draft.note,
    occurredAt: draft.occurredAt,
    receiptPath: draft.receiptPath,
  };
}

const positive = (minor: number | null) => (minor !== null && minor > 0 ? minor : null);

/** What POST /transactions or PATCH /transactions/:id is sent, as the phone sends it. */
export function transactionBody(
  form: Form,
  options: { crossCurrency: boolean; adjustmentMinor?: number },
) {
  return {
    ...form,
    amountMinor:
      form.type === "adjustment" ? (options.adjustmentMinor ?? form.amountMinor) : form.amountMinor,
    toAccountId: form.type === "transfer" ? form.toAccountId : null,
    toAmountMinor: form.type === "transfer" && options.crossCurrency ? form.toAmountMinor : null,
    categoryId: form.type === "transfer" ? null : form.categoryId,
    note: form.note.trim() || null,
  };
}

/** The first message per field, from a failed check. */
export function fieldErrors(error: z.ZodError): Partial<Record<keyof Form, string>> {
  const errors: Partial<Record<keyof Form, string>> = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof Form | undefined;
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}
