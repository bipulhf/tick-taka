import { z } from "zod";
import {
  currencySchema,
  emojiSchema,
  epochMsSchema,
  idSchema,
  localDateSchema,
  localMonthSchema,
  minorSchema,
  nameSchema,
  noteSchema,
  positiveMinorSchema,
  queryEpochSchema,
  rruleSchema,
} from "./common";

export const ACCOUNT_TYPES = ["cash", "bank", "mobile_wallet", "card", "savings"] as const;
export const CATEGORY_KINDS = ["expense", "income"] as const;
export const BUDGET_TYPES = ["fixed", "non_monthly", "flexible"] as const;
export const TRANSACTION_TYPES = ["expense", "income", "transfer", "adjustment"] as const;
export const RECURRING_KINDS = ["bill", "income"] as const;
export const DEBT_DIRECTIONS = ["owed_to_me", "i_owe"] as const;
export const SMS_STATUSES = ["pending", "added", "ignored"] as const;
export const SMS_DIRECTIONS = ["in", "out", "cash_out"] as const;

export type AccountType = (typeof ACCOUNT_TYPES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type BudgetType = (typeof BUDGET_TYPES)[number];

// Accounts ----------------------------------------------------------------------
export const accountCreateSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  type: z.enum(ACCOUNT_TYPES),
  currency: currencySchema.default("BDT"),
  openingMinor: minorSchema.default(0),
  icon: z.string().max(40).nullable().optional(),
  sort: z.number().int().optional(),
});
export const accountUpdateSchema = z
  .object({
    name: nameSchema,
    type: z.enum(ACCOUNT_TYPES),
    openingMinor: minorSchema,
    icon: z.string().max(40).nullable(),
    archived: z.boolean(),
    sort: z.number().int(),
  })
  .partial();
export const balanceCheckSchema = z.object({
  actualMinor: minorSchema,
  occurredAt: epochMsSchema.optional(),
  id: idSchema.optional(),
});

// Categories ------------------------------------------------------------------
export const categoryCreateSchema = z.object({
  id: idSchema.optional(),
  parentId: idSchema.nullable().optional(),
  name: nameSchema,
  emoji: emojiSchema,
  kind: z.enum(CATEGORY_KINDS).default("expense"),
  budgetType: z.enum(BUDGET_TYPES).default("flexible"),
  sort: z.number().int().optional(),
});
export const categoryUpdateSchema = z
  .object({
    parentId: idSchema.nullable(),
    name: nameSchema,
    emoji: emojiSchema,
    budgetType: z.enum(BUDGET_TYPES),
    sort: z.number().int(),
  })
  .partial();

// Transactions --------------------------------------------------------------
const transactionBase = z.object({
  id: idSchema.optional(),
  type: z.enum(TRANSACTION_TYPES),
  accountId: idSchema,
  toAccountId: idSchema.nullable().optional(),
  /** Always positive; the type decides the sign. Adjustments may be negative. */
  amountMinor: minorSchema,
  toAmountMinor: positiveMinorSchema.nullable().optional(),
  feeMinor: z.number().int().nonnegative().default(0),
  categoryId: idSchema.nullable().optional(),
  areaId: idSchema.nullable().optional(),
  goalId: idSchema.nullable().optional(),
  debtId: idSchema.nullable().optional(),
  eventId: idSchema.nullable().optional(),
  recurringId: idSchema.nullable().optional(),
  note: noteSchema.nullable().optional(),
  receiptPath: z.string().max(300).nullable().optional(),
  occurredAt: epochMsSchema,
});

export const transactionCreateSchema = transactionBase.superRefine((value, ctx) => {
  if (value.type === "transfer") {
    if (!value.toAccountId)
      ctx.addIssue({
        code: "custom",
        message: "Pick the account to move money to",
        path: ["toAccountId"],
      });
    if (value.toAccountId === value.accountId)
      ctx.addIssue({
        code: "custom",
        message: "Pick two different accounts",
        path: ["toAccountId"],
      });
  }
  if (value.type !== "adjustment" && value.amountMinor <= 0)
    ctx.addIssue({
      code: "custom",
      message: "Amount must be more than zero",
      path: ["amountMinor"],
    });
});
export type TransactionCreate = z.infer<typeof transactionCreateSchema>;

export const transactionUpdateSchema = transactionBase
  .omit({ id: true })
  .extend({ updatedAt: epochMsSchema })
  .partial();
export type TransactionUpdate = z.infer<typeof transactionUpdateSchema>;

export const transactionListQuerySchema = z.object({
  from: queryEpochSchema.optional(),
  to: queryEpochSchema.optional(),
  accountId: idSchema.optional(),
  categoryId: idSchema.optional(),
  areaId: idSchema.optional(),
  eventId: idSchema.optional(),
  goalId: idSchema.optional(),
  debtId: idSchema.optional(),
  type: z.enum(TRANSACTION_TYPES).optional(),
  q: z.string().max(200).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type TransactionListQuery = z.infer<typeof transactionListQuerySchema>;

// Budgets ---------------------------------------------------------------------
export const budgetMonthQuerySchema = z.object({ month: localMonthSchema });
export const budgetsPutSchema = z.object({
  month: localMonthSchema,
  budgets: z
    .array(
      z.object({
        categoryId: idSchema,
        limitMinor: z.number().int().nonnegative(),
        rollover: z.boolean().default(false),
      }),
    )
    .max(200),
});

// Recurring -------------------------------------------------------------------
export const recurringCreateSchema = z.object({
  id: idSchema.optional(),
  kind: z.enum(RECURRING_KINDS),
  name: nameSchema,
  amountMinor: positiveMinorSchema,
  currency: currencySchema.default("BDT"),
  accountId: idSchema.nullable().optional(),
  categoryId: idSchema.nullable().optional(),
  areaId: idSchema.nullable().optional(),
  rrule: rruleSchema,
  nextDueAt: epochMsSchema,
  remindDays: z.number().int().min(0).max(30).default(2),
});
export const recurringUpdateSchema = recurringCreateSchema
  .omit({ id: true })
  .extend({ active: z.boolean() })
  .partial();
export const recurringPaySchema = z.object({
  transactionId: idSchema.optional(),
  occurredAt: epochMsSchema.optional(),
  accountId: idSchema.optional(),
  /** Amount in the recurring item's currency, when it differs from the plan. */
  amountMinor: positiveMinorSchema.optional(),
  /** Amount that landed in the account, in the account currency (foreign salary). */
  receivedMinor: positiveMinorSchema.optional(),
  /** Rate entered for a foreign-currency income: account units per one unit of item currency. */
  rate: z.number().positive().optional(),
  skip: z.boolean().default(false),
});

// Goals -----------------------------------------------------------------------
export const goalCreateSchema = z.object({
  id: idSchema.optional(),
  name: nameSchema,
  emoji: emojiSchema.default("🫙"),
  targetMinor: positiveMinorSchema,
  deadline: localDateSchema.nullable().optional(),
  accountId: idSchema.nullable().optional(),
  createTasks: z.boolean().default(true),
});
export const goalUpdateSchema = goalCreateSchema
  .omit({ id: true })
  .extend({ done: z.boolean() })
  .partial();
export const goalContributeSchema = z.object({
  id: idSchema.optional(),
  amountMinor: positiveMinorSchema,
  fromAccountId: idSchema,
  occurredAt: epochMsSchema.optional(),
});

// Debts -----------------------------------------------------------------------
export const debtCreateSchema = z.object({
  id: idSchema.optional(),
  person: nameSchema,
  direction: z.enum(DEBT_DIRECTIONS),
  principalMinor: positiveMinorSchema,
  currency: currencySchema.default("BDT"),
  dueAt: epochMsSchema.nullable().optional(),
  remindAt: epochMsSchema.nullable().optional(),
  note: noteSchema.nullable().optional(),
  /** Records the money leaving/entering this account when the debt starts. */
  accountId: idSchema.nullable().optional(),
  occurredAt: epochMsSchema.optional(),
});
export const debtUpdateSchema = z
  .object({
    person: nameSchema,
    dueAt: epochMsSchema.nullable(),
    remindAt: epochMsSchema.nullable(),
    note: noteSchema.nullable(),
    closed: z.boolean(),
  })
  .partial();
export const debtRepaySchema = z.object({
  id: idSchema.optional(),
  amountMinor: positiveMinorSchema,
  accountId: idSchema,
  occurredAt: epochMsSchema.optional(),
});
export const debtForecastQuerySchema = z.object({ monthly: z.coerce.number().int().positive() });

// Events ------------------------------------------------------------------------
export const eventCreateSchema = z
  .object({
    id: idSchema.optional(),
    name: nameSchema,
    emoji: emojiSchema.default("✈️"),
    budgetMinor: z.number().int().nonnegative().nullable().optional(),
    startsOn: localDateSchema,
    endsOn: localDateSchema,
  })
  .refine((v) => v.endsOn >= v.startsOn, {
    message: "End date must be on or after start",
    path: ["endsOn"],
  });
export const eventUpdateSchema = z
  .object({
    name: nameSchema,
    emoji: emojiSchema,
    budgetMinor: z.number().int().nonnegative().nullable(),
    startsOn: localDateSchema,
    endsOn: localDateSchema,
  })
  .partial();

// Shopping lists ----------------------------------------------------------------
export const shoppingItemCreateSchema = z.object({
  id: idSchema.optional(),
  listName: z.string().trim().min(1).max(60).default("Bazar"),
  title: z.string().trim().min(1).max(200),
  estMinor: z.number().int().nonnegative().nullable().optional(),
  sort: z.number().int().optional(),
});
export const shoppingItemUpdateSchema = z
  .object({
    listName: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(200),
    estMinor: z.number().int().nonnegative().nullable(),
    checked: z.boolean(),
    sort: z.number().int(),
  })
  .partial();
export const shoppingCheckoutSchema = z.object({
  transactionId: idSchema.optional(),
  listName: z.string().trim().min(1).max(60),
  accountId: idSchema,
  categoryId: idSchema.nullable().optional(),
  eventId: idSchema.nullable().optional(),
  /** Actual total paid; defaults to the sum of checked estimates. */
  amountMinor: positiveMinorSchema.optional(),
  occurredAt: epochMsSchema.optional(),
  note: noteSchema.nullable().optional(),
});

// Category rules (learn from corrections) ---------------------------------------
export const categoryRuleCreateSchema = z.object({
  id: idSchema.optional(),
  matchText: z.string().trim().min(2).max(80),
  categoryId: idSchema.nullable(),
  areaId: idSchema.nullable().optional(),
});

// SMS imports -------------------------------------------------------------------
export const smsImportItemSchema = z.object({
  fingerprint: z.string().min(3).max(120),
  sender: z.string().min(1).max(40),
  receivedAt: epochMsSchema,
  amountMinor: z.number().int().nonnegative(),
  direction: z.enum(SMS_DIRECTIONS),
});
export const smsImportBatchSchema = z.object({ items: z.array(smsImportItemSchema).max(500) });
export const smsImportPatchSchema = z.object({
  status: z.enum(SMS_STATUSES),
  transactionId: idSchema.nullable().optional(),
});

// Reports -----------------------------------------------------------------------
export const rangeQuerySchema = z.object({ from: queryEpochSchema, to: queryEpochSchema });
export const monthQuerySchema = z.object({ month: localMonthSchema.optional() });
