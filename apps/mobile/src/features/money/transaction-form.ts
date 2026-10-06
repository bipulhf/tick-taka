import { z } from "zod";

/** The transaction sheet's form and its checks. */

export type TxType = "expense" | "income" | "transfer";

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
