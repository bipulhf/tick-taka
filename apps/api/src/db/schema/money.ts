import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { baseColumns, bool, isLocalDate, isLocalMonth, oneOf, rule } from "../columns";
import { areas } from "./time";

const ACCOUNT_TYPES = ["cash", "bank", "mobile_wallet", "card", "savings"] as const;
const CATEGORY_KINDS = ["expense", "income"] as const;
const BUDGET_TYPES = ["fixed", "non_monthly", "flexible"] as const;
const DEBT_DIRECTIONS = ["owed_to_me", "i_owe"] as const;
const RECURRING_KINDS = ["bill", "income"] as const;
const TRANSACTION_TYPES = ["expense", "income", "transfer", "adjustment"] as const;
const SMS_DIRECTIONS = ["in", "out", "cash_out"] as const;
const SMS_STATUSES = ["pending", "added", "ignored"] as const;

export const accounts = sqliteTable(
  "accounts",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    type: text("type", { enum: ACCOUNT_TYPES }).notNull(),
    currency: text("currency").notNull().default("BDT"),
    openingMinor: integer("opening_minor").notNull().default(0),
    icon: text("icon"),
    sort: integer("sort").notNull().default(0),
    archivedAt: integer("archived_at"),
  },
  () => [check("accounts_type_check", oneOf("type", ACCOUNT_TYPES))],
);

export const categories = sqliteTable(
  "categories",
  {
    ...baseColumns(),
    parentId: text("parent_id").references((): AnySQLiteColumn => categories.id),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    kind: text("kind", { enum: CATEGORY_KINDS }).notNull(),
    budgetType: text("budget_type", { enum: BUDGET_TYPES }).notNull().default("flexible"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("categories_updated_at_idx").on(t.updatedAt),
    index("categories_parent_idx").on(t.parentId),
    check("categories_kind_check", oneOf("kind", CATEGORY_KINDS)),
    check("categories_budget_type_check", oneOf("budget_type", BUDGET_TYPES)),
    check("categories_parent_self_check", rule(`"parent_id" <> "id"`)),
  ],
);

export const goals = sqliteTable(
  "goals",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    targetMinor: integer("target_minor").notNull(),
    /** Local date YYYY-MM-DD */
    deadline: text("deadline"),
    accountId: text("account_id").references(() => accounts.id),
    createTasks: bool("create_tasks").notNull().default(true),
    doneAt: integer("done_at"),
  },
  () => [
    check("goals_target_check", rule(`"target_minor" > 0`)),
    check("goals_deadline_check", isLocalDate("deadline")),
  ],
);

export const debts = sqliteTable(
  "debts",
  {
    ...baseColumns(),
    person: text("person").notNull(),
    direction: text("direction", { enum: DEBT_DIRECTIONS }).notNull(),
    principalMinor: integer("principal_minor").notNull(),
    currency: text("currency").notNull().default("BDT"),
    dueAt: integer("due_at"),
    remindAt: integer("remind_at"),
    note: text("note"),
    closedAt: integer("closed_at"),
  },
  () => [
    check("debts_direction_check", oneOf("direction", DEBT_DIRECTIONS)),
    check("debts_principal_check", rule(`"principal_minor" > 0`)),
  ],
);

export const events = sqliteTable(
  "events",
  {
    ...baseColumns(),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    budgetMinor: integer("budget_minor"),
    startsOn: text("starts_on").notNull(),
    endsOn: text("ends_on").notNull(),
  },
  () => [
    check("events_budget_check", rule(`"budget_minor" >= 0`)),
    check("events_starts_on_check", isLocalDate("starts_on")),
    check("events_ends_on_check", isLocalDate("ends_on")),
    check("events_range_check", rule(`"ends_on" >= "starts_on"`)),
  ],
);

export const recurring = sqliteTable(
  "recurring",
  {
    ...baseColumns(),
    kind: text("kind", { enum: RECURRING_KINDS }).notNull(),
    name: text("name").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull().default("BDT"),
    accountId: text("account_id").references(() => accounts.id),
    categoryId: text("category_id").references(() => categories.id),
    areaId: text("area_id").references(() => areas.id),
    rrule: text("rrule").notNull(),
    nextDueAt: integer("next_due_at").notNull(),
    remindDays: integer("remind_days").notNull().default(2),
    active: bool("active").notNull().default(true),
    /** Set by the midnight job when next_due_at passes unpaid */
    overdueAt: integer("overdue_at"),
  },
  (t) => [
    index("recurring_updated_at_idx").on(t.updatedAt),
    index("recurring_next_due_idx").on(t.nextDueAt),
    check("recurring_kind_check", oneOf("kind", RECURRING_KINDS)),
    check("recurring_amount_check", rule(`"amount_minor" > 0`)),
    check("recurring_remind_days_check", rule(`"remind_days" >= 0`)),
  ],
);

export const transactions = sqliteTable(
  "transactions",
  {
    ...baseColumns(),
    type: text("type", { enum: TRANSACTION_TYPES }).notNull(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id),
    toAccountId: text("to_account_id").references(() => accounts.id),
    /** Positive for expense/income/transfer; signed for adjustments */
    amountMinor: integer("amount_minor").notNull(),
    /** Amount arriving in the destination account, for cross-currency transfers */
    toAmountMinor: integer("to_amount_minor"),
    feeMinor: integer("fee_minor").notNull().default(0),
    categoryId: text("category_id").references(() => categories.id),
    areaId: text("area_id").references(() => areas.id),
    goalId: text("goal_id").references(() => goals.id),
    debtId: text("debt_id").references(() => debts.id),
    eventId: text("event_id").references(() => events.id),
    recurringId: text("recurring_id").references(() => recurring.id),
    note: text("note"),
    receiptPath: text("receipt_path"),
    occurredAt: integer("occurred_at").notNull(),
  },
  (t) => [
    index("transactions_occurred_at_idx").on(t.occurredAt),
    index("transactions_account_idx").on(t.accountId),
    index("transactions_to_account_idx").on(t.toAccountId),
    index("transactions_category_idx").on(t.categoryId),
    index("transactions_updated_at_idx").on(t.updatedAt),
    check("transactions_type_check", oneOf("type", TRANSACTION_TYPES)),
    check("transactions_amount_check", rule(`"type" = 'adjustment' OR "amount_minor" > 0`)),
    check("transactions_to_amount_check", rule(`"to_amount_minor" > 0`)),
    check("transactions_fee_check", rule(`"fee_minor" >= 0`)),
  ],
);

export const budgets = sqliteTable(
  "budgets",
  {
    ...baseColumns(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    /** Local month YYYY-MM */
    month: text("month").notNull(),
    limitMinor: integer("limit_minor").notNull(),
    rollover: bool("rollover").notNull().default(false),
  },
  (t) => [
    index("budgets_updated_at_idx").on(t.updatedAt),
    uniqueIndex("budgets_category_month_uq").on(t.categoryId, t.month),
    check("budgets_month_check", isLocalMonth("month")),
    check("budgets_limit_check", rule(`"limit_minor" >= 0`)),
  ],
);

export const shoppingItems = sqliteTable(
  "shopping_items",
  {
    ...baseColumns(),
    listName: text("list_name").notNull(),
    title: text("title").notNull(),
    estMinor: integer("est_minor"),
    checkedAt: integer("checked_at"),
    transactionId: text("transaction_id").references(() => transactions.id),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [
    index("shopping_items_updated_at_idx").on(t.updatedAt),
    index("shopping_items_list_idx").on(t.listName),
    check("shopping_items_estimate_check", rule(`"est_minor" >= 0`)),
  ],
);

export const categoryRules = sqliteTable(
  "category_rules",
  {
    ...baseColumns(),
    matchText: text("match_text").notNull(),
    categoryId: text("category_id").references(() => categories.id),
    areaId: text("area_id").references(() => areas.id),
  },
  (t) => [uniqueIndex("category_rules_match_uq").on(t.matchText)],
);

/**
 * From the SMS capture that was dropped (docs/IMPLEMENTATION_PLAN.md, Scope changes).
 * Nothing writes to it any more, but databases from before the drop hold real rows,
 * so the table stays and its rows keep appearing in the JSON export.
 */
export const smsImports = sqliteTable(
  "sms_imports",
  {
    ...baseColumns(),
    fingerprint: text("fingerprint").notNull(),
    sender: text("sender").notNull(),
    receivedAt: integer("received_at").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    direction: text("direction", { enum: SMS_DIRECTIONS }).notNull(),
    status: text("status", { enum: SMS_STATUSES }).notNull().default("pending"),
    transactionId: text("transaction_id").references(() => transactions.id),
  },
  (t) => [
    index("sms_imports_updated_at_idx").on(t.updatedAt),
    uniqueIndex("sms_imports_fingerprint_uq").on(t.fingerprint),
    check("sms_imports_direction_check", oneOf("direction", SMS_DIRECTIONS)),
    check("sms_imports_status_check", oneOf("status", SMS_STATUSES)),
  ],
);
