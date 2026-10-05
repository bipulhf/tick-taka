import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { baseColumns, bool } from "../columns";
import { areas } from "./time";

export const accounts = sqliteTable("accounts", {
  ...baseColumns(),
  name: text("name").notNull(),
  type: text("type", { enum: ["cash", "bank", "mobile_wallet", "card", "savings"] }).notNull(),
  currency: text("currency").notNull().default("BDT"),
  openingMinor: integer("opening_minor").notNull().default(0),
  icon: text("icon"),
  sort: integer("sort").notNull().default(0),
  archivedAt: integer("archived_at"),
});

export const categories = sqliteTable(
  "categories",
  {
    ...baseColumns(),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    emoji: text("emoji").notNull(),
    kind: text("kind", { enum: ["expense", "income"] }).notNull(),
    budgetType: text("budget_type", { enum: ["fixed", "non_monthly", "flexible"] })
      .notNull()
      .default("flexible"),
    sort: integer("sort").notNull().default(0),
  },
  (t) => [index("categories_parent_idx").on(t.parentId)],
);

export const goals = sqliteTable("goals", {
  ...baseColumns(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  targetMinor: integer("target_minor").notNull(),
  /** Local date YYYY-MM-DD */
  deadline: text("deadline"),
  accountId: text("account_id").references(() => accounts.id),
  createTasks: bool("create_tasks").notNull().default(true),
  doneAt: integer("done_at"),
});

export const debts = sqliteTable("debts", {
  ...baseColumns(),
  person: text("person").notNull(),
  direction: text("direction", { enum: ["owed_to_me", "i_owe"] }).notNull(),
  principalMinor: integer("principal_minor").notNull(),
  currency: text("currency").notNull().default("BDT"),
  dueAt: integer("due_at"),
  remindAt: integer("remind_at"),
  note: text("note"),
  closedAt: integer("closed_at"),
});

export const events = sqliteTable("events", {
  ...baseColumns(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  budgetMinor: integer("budget_minor"),
  startsOn: text("starts_on").notNull(),
  endsOn: text("ends_on").notNull(),
});

export const recurring = sqliteTable(
  "recurring",
  {
    ...baseColumns(),
    kind: text("kind", { enum: ["bill", "income"] }).notNull(),
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
  (t) => [index("recurring_next_due_idx").on(t.nextDueAt)],
);

export const transactions = sqliteTable(
  "transactions",
  {
    ...baseColumns(),
    type: text("type", { enum: ["expense", "income", "transfer", "adjustment"] }).notNull(),
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
  (t) => [uniqueIndex("budgets_category_month_uq").on(t.categoryId, t.month)],
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
  (t) => [index("shopping_items_list_idx").on(t.listName)],
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

/** From the SMS capture that was removed; kept so earlier rows stay in exports. */
export const smsImports = sqliteTable(
  "sms_imports",
  {
    ...baseColumns(),
    fingerprint: text("fingerprint").notNull(),
    sender: text("sender").notNull(),
    receivedAt: integer("received_at").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    direction: text("direction", { enum: ["in", "out", "cash_out"] }).notNull(),
    status: text("status", { enum: ["pending", "added", "ignored"] })
      .notNull()
      .default("pending"),
    transactionId: text("transaction_id").references(() => transactions.id),
  },
  (t) => [uniqueIndex("sms_imports_fingerprint_uq").on(t.fingerprint)],
);
