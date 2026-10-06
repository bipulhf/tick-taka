PRAGMA foreign_keys=OFF;--> statement-breakpoint
-- Self-references and tasks.goal_id had no foreign keys; clear any link to a row that
-- doesn't exist so the rebuilt tables pass PRAGMA foreign_key_check.
UPDATE `tasks` SET `parent_id` = NULL WHERE `parent_id` IS NOT NULL AND `parent_id` NOT IN (SELECT `id` FROM `tasks`);--> statement-breakpoint
UPDATE `tasks` SET `goal_id` = NULL WHERE `goal_id` IS NOT NULL AND `goal_id` NOT IN (SELECT `id` FROM `goals`);--> statement-breakpoint
UPDATE `tasks` SET `next_id` = NULL WHERE `next_id` IS NOT NULL AND `next_id` NOT IN (SELECT `id` FROM `tasks`);--> statement-breakpoint
UPDATE `categories` SET `parent_id` = NULL WHERE `parent_id` IS NOT NULL AND `parent_id` NOT IN (SELECT `id` FROM `categories`);--> statement-breakpoint
CREATE TABLE `__new_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text DEFAULT 'BDT' NOT NULL,
	`opening_minor` integer DEFAULT 0 NOT NULL,
	`icon` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	CONSTRAINT "accounts_type_check" CHECK("type" IN ('cash', 'bank', 'mobile_wallet', 'card', 'savings'))
);
--> statement-breakpoint
INSERT INTO `__new_accounts`("id", "created_at", "updated_at", "deleted_at", "name", "type", "currency", "opening_minor", "icon", "sort", "archived_at") SELECT "id", "created_at", "updated_at", "deleted_at", "name", "type", "currency", "opening_minor", "icon", "sort", "archived_at" FROM `accounts`;--> statement-breakpoint
DROP TABLE `accounts`;--> statement-breakpoint
ALTER TABLE `__new_accounts` RENAME TO `accounts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_budgets` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`category_id` text NOT NULL,
	`month` text NOT NULL,
	`limit_minor` integer NOT NULL,
	`rollover` integer DEFAULT false NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "budgets_month_check" CHECK("month" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]'),
	CONSTRAINT "budgets_limit_check" CHECK("limit_minor" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_budgets`("id", "created_at", "updated_at", "deleted_at", "category_id", "month", "limit_minor", "rollover") SELECT "id", "created_at", "updated_at", "deleted_at", "category_id", "month", "limit_minor", "rollover" FROM `budgets`;--> statement-breakpoint
DROP TABLE `budgets`;--> statement-breakpoint
ALTER TABLE `__new_budgets` RENAME TO `budgets`;--> statement-breakpoint
CREATE UNIQUE INDEX `budgets_category_month_uq` ON `budgets` (`category_id`,`month`);--> statement-breakpoint
CREATE TABLE `__new_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`parent_id` text,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`kind` text NOT NULL,
	`budget_type` text DEFAULT 'flexible' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "categories_kind_check" CHECK("kind" IN ('expense', 'income')),
	CONSTRAINT "categories_budget_type_check" CHECK("budget_type" IN ('fixed', 'non_monthly', 'flexible')),
	CONSTRAINT "categories_parent_self_check" CHECK("parent_id" <> "id")
);
--> statement-breakpoint
INSERT INTO `__new_categories`("id", "created_at", "updated_at", "deleted_at", "parent_id", "name", "emoji", "kind", "budget_type", "sort") SELECT "id", "created_at", "updated_at", "deleted_at", "parent_id", "name", "emoji", "kind", "budget_type", "sort" FROM `categories`;--> statement-breakpoint
DROP TABLE `categories`;--> statement-breakpoint
ALTER TABLE `__new_categories` RENAME TO `categories`;--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `__new_debts` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`person` text NOT NULL,
	`direction` text NOT NULL,
	`principal_minor` integer NOT NULL,
	`currency` text DEFAULT 'BDT' NOT NULL,
	`due_at` integer,
	`remind_at` integer,
	`note` text,
	`closed_at` integer,
	CONSTRAINT "debts_direction_check" CHECK("direction" IN ('owed_to_me', 'i_owe')),
	CONSTRAINT "debts_principal_check" CHECK("principal_minor" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_debts`("id", "created_at", "updated_at", "deleted_at", "person", "direction", "principal_minor", "currency", "due_at", "remind_at", "note", "closed_at") SELECT "id", "created_at", "updated_at", "deleted_at", "person", "direction", "principal_minor", "currency", "due_at", "remind_at", "note", "closed_at" FROM `debts`;--> statement-breakpoint
DROP TABLE `debts`;--> statement-breakpoint
ALTER TABLE `__new_debts` RENAME TO `debts`;--> statement-breakpoint
CREATE TABLE `__new_events` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`budget_minor` integer,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	CONSTRAINT "events_budget_check" CHECK("budget_minor" >= 0),
	CONSTRAINT "events_starts_on_check" CHECK("starts_on" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "events_ends_on_check" CHECK("ends_on" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "events_range_check" CHECK("ends_on" >= "starts_on")
);
--> statement-breakpoint
INSERT INTO `__new_events`("id", "created_at", "updated_at", "deleted_at", "name", "emoji", "budget_minor", "starts_on", "ends_on") SELECT "id", "created_at", "updated_at", "deleted_at", "name", "emoji", "budget_minor", "starts_on", "ends_on" FROM `events`;--> statement-breakpoint
DROP TABLE `events`;--> statement-breakpoint
ALTER TABLE `__new_events` RENAME TO `events`;--> statement-breakpoint
CREATE TABLE `__new_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`target_minor` integer NOT NULL,
	`deadline` text,
	`account_id` text,
	`create_tasks` integer DEFAULT true NOT NULL,
	`done_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "goals_target_check" CHECK("target_minor" > 0),
	CONSTRAINT "goals_deadline_check" CHECK("deadline" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]')
);
--> statement-breakpoint
INSERT INTO `__new_goals`("id", "created_at", "updated_at", "deleted_at", "name", "emoji", "target_minor", "deadline", "account_id", "create_tasks", "done_at") SELECT "id", "created_at", "updated_at", "deleted_at", "name", "emoji", "target_minor", "deadline", "account_id", "create_tasks", "done_at" FROM `goals`;--> statement-breakpoint
DROP TABLE `goals`;--> statement-breakpoint
ALTER TABLE `__new_goals` RENAME TO `goals`;--> statement-breakpoint
CREATE TABLE `__new_recurring` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`kind` text NOT NULL,
	`name` text NOT NULL,
	`amount_minor` integer NOT NULL,
	`currency` text DEFAULT 'BDT' NOT NULL,
	`account_id` text,
	`category_id` text,
	`area_id` text,
	`rrule` text NOT NULL,
	`next_due_at` integer NOT NULL,
	`remind_days` integer DEFAULT 2 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`overdue_at` integer,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "recurring_kind_check" CHECK("kind" IN ('bill', 'income')),
	CONSTRAINT "recurring_amount_check" CHECK("amount_minor" > 0),
	CONSTRAINT "recurring_remind_days_check" CHECK("remind_days" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_recurring`("id", "created_at", "updated_at", "deleted_at", "kind", "name", "amount_minor", "currency", "account_id", "category_id", "area_id", "rrule", "next_due_at", "remind_days", "active", "overdue_at") SELECT "id", "created_at", "updated_at", "deleted_at", "kind", "name", "amount_minor", "currency", "account_id", "category_id", "area_id", "rrule", "next_due_at", "remind_days", "active", "overdue_at" FROM `recurring`;--> statement-breakpoint
DROP TABLE `recurring`;--> statement-breakpoint
ALTER TABLE `__new_recurring` RENAME TO `recurring`;--> statement-breakpoint
CREATE INDEX `recurring_next_due_idx` ON `recurring` (`next_due_at`);--> statement-breakpoint
CREATE TABLE `__new_shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`list_name` text NOT NULL,
	`title` text NOT NULL,
	`est_minor` integer,
	`checked_at` integer,
	`transaction_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "shopping_items_estimate_check" CHECK("est_minor" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_shopping_items`("id", "created_at", "updated_at", "deleted_at", "list_name", "title", "est_minor", "checked_at", "transaction_id", "sort") SELECT "id", "created_at", "updated_at", "deleted_at", "list_name", "title", "est_minor", "checked_at", "transaction_id", "sort" FROM `shopping_items`;--> statement-breakpoint
DROP TABLE `shopping_items`;--> statement-breakpoint
ALTER TABLE `__new_shopping_items` RENAME TO `shopping_items`;--> statement-breakpoint
CREATE INDEX `shopping_items_list_idx` ON `shopping_items` (`list_name`);--> statement-breakpoint
CREATE TABLE `__new_sms_imports` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`fingerprint` text NOT NULL,
	`sender` text NOT NULL,
	`received_at` integer NOT NULL,
	`amount_minor` integer NOT NULL,
	`direction` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`transaction_id` text,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "sms_imports_direction_check" CHECK("direction" IN ('in', 'out', 'cash_out')),
	CONSTRAINT "sms_imports_status_check" CHECK("status" IN ('pending', 'added', 'ignored'))
);
--> statement-breakpoint
INSERT INTO `__new_sms_imports`("id", "created_at", "updated_at", "deleted_at", "fingerprint", "sender", "received_at", "amount_minor", "direction", "status", "transaction_id") SELECT "id", "created_at", "updated_at", "deleted_at", "fingerprint", "sender", "received_at", "amount_minor", "direction", "status", "transaction_id" FROM `sms_imports`;--> statement-breakpoint
DROP TABLE `sms_imports`;--> statement-breakpoint
ALTER TABLE `__new_sms_imports` RENAME TO `sms_imports`;--> statement-breakpoint
CREATE UNIQUE INDEX `sms_imports_fingerprint_uq` ON `sms_imports` (`fingerprint`);--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`type` text NOT NULL,
	`account_id` text NOT NULL,
	`to_account_id` text,
	`amount_minor` integer NOT NULL,
	`to_amount_minor` integer,
	`fee_minor` integer DEFAULT 0 NOT NULL,
	`category_id` text,
	`area_id` text,
	`goal_id` text,
	`debt_id` text,
	`event_id` text,
	`recurring_id` text,
	`note` text,
	`receipt_path` text,
	`occurred_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`debt_id`) REFERENCES `debts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`recurring_id`) REFERENCES `recurring`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "transactions_type_check" CHECK("type" IN ('expense', 'income', 'transfer', 'adjustment')),
	CONSTRAINT "transactions_amount_check" CHECK("type" = 'adjustment' OR "amount_minor" > 0),
	CONSTRAINT "transactions_to_amount_check" CHECK("to_amount_minor" > 0),
	CONSTRAINT "transactions_fee_check" CHECK("fee_minor" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`("id", "created_at", "updated_at", "deleted_at", "type", "account_id", "to_account_id", "amount_minor", "to_amount_minor", "fee_minor", "category_id", "area_id", "goal_id", "debt_id", "event_id", "recurring_id", "note", "receipt_path", "occurred_at") SELECT "id", "created_at", "updated_at", "deleted_at", "type", "account_id", "to_account_id", "amount_minor", "to_amount_minor", "fee_minor", "category_id", "area_id", "goal_id", "debt_id", "event_id", "recurring_id", "note", "receipt_path", "occurred_at" FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
CREATE INDEX `transactions_occurred_at_idx` ON `transactions` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_to_account_idx` ON `transactions` (`to_account_id`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_updated_at_idx` ON `transactions` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_habit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`habit_id` text NOT NULL,
	`date` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "habit_logs_date_check" CHECK("date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "habit_logs_count_check" CHECK("count" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_habit_logs`("id", "created_at", "updated_at", "deleted_at", "habit_id", "date", "count") SELECT "id", "created_at", "updated_at", "deleted_at", "habit_id", "date", "count" FROM `habit_logs`;--> statement-breakpoint
DROP TABLE `habit_logs`;--> statement-breakpoint
ALTER TABLE `__new_habit_logs` RENAME TO `habit_logs`;--> statement-breakpoint
CREATE UNIQUE INDEX `habit_logs_habit_date_uq` ON `habit_logs` (`habit_id`,`date`);--> statement-breakpoint
CREATE TABLE `__new_habits` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`name` text NOT NULL,
	`emoji` text NOT NULL,
	`color` text NOT NULL,
	`schedule` text DEFAULT 'daily' NOT NULL,
	`per_week` integer,
	`target_count` integer DEFAULT 1 NOT NULL,
	`remind_at` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	CONSTRAINT "habits_schedule_check" CHECK("schedule" IN ('daily', 'weekly', 'n_per_week')),
	CONSTRAINT "habits_per_week_check" CHECK("per_week" BETWEEN 1 AND 7),
	CONSTRAINT "habits_target_check" CHECK("target_count" >= 1)
);
--> statement-breakpoint
INSERT INTO `__new_habits`("id", "created_at", "updated_at", "deleted_at", "name", "emoji", "color", "schedule", "per_week", "target_count", "remind_at", "sort", "archived_at") SELECT "id", "created_at", "updated_at", "deleted_at", "name", "emoji", "color", "schedule", "per_week", "target_count", "remind_at", "sort", "archived_at" FROM `habits`;--> statement-breakpoint
DROP TABLE `habits`;--> statement-breakpoint
ALTER TABLE `__new_habits` RENAME TO `habits`;--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`area_id` text NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "projects_status_check" CHECK("status" IN ('active', 'paused', 'done'))
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "created_at", "updated_at", "deleted_at", "area_id", "name", "status", "sort") SELECT "id", "created_at", "updated_at", "deleted_at", "area_id", "name", "status", "sort" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE INDEX `projects_area_idx` ON `projects` (`area_id`);--> statement-breakpoint
CREATE TABLE `__new_routine_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`routine_id` text NOT NULL,
	`title` text NOT NULL,
	`minutes` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "routine_steps_minutes_check" CHECK("minutes" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_routine_steps`("id", "created_at", "updated_at", "deleted_at", "routine_id", "title", "minutes", "sort") SELECT "id", "created_at", "updated_at", "deleted_at", "routine_id", "title", "minutes", "sort" FROM `routine_steps`;--> statement-breakpoint
DROP TABLE `routine_steps`;--> statement-breakpoint
ALTER TABLE `__new_routine_steps` RENAME TO `routine_steps`;--> statement-breakpoint
CREATE INDEX `routine_steps_routine_idx` ON `routine_steps` (`routine_id`);--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`project_id` text,
	`area_id` text,
	`parent_id` text,
	`title` text NOT NULL,
	`notes` text,
	`status` text DEFAULT 'inbox' NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`do_at` integer,
	`has_time` integer DEFAULT false NOT NULL,
	`when_slot` text DEFAULT 'day' NOT NULL,
	`deadline_at` integer,
	`energy` text,
	`estimate_min` integer,
	`reminder_at` integer,
	`rrule` text,
	`top3_date` text,
	`urgent` integer DEFAULT false NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`done_at` integer,
	`goal_id` text,
	`next_id` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`goal_id`) REFERENCES `goals`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`next_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tasks_status_check" CHECK("status" IN ('inbox', 'open', 'someday', 'done')),
	CONSTRAINT "tasks_priority_check" CHECK("priority" IN ('low', 'normal', 'high')),
	CONSTRAINT "tasks_when_slot_check" CHECK("when_slot" IN ('day', 'evening')),
	CONSTRAINT "tasks_energy_check" CHECK("energy" IN ('high', 'low')),
	CONSTRAINT "tasks_estimate_check" CHECK("estimate_min" >= 0),
	CONSTRAINT "tasks_top3_date_check" CHECK("top3_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "tasks_parent_self_check" CHECK("parent_id" <> "id")
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "created_at", "updated_at", "deleted_at", "project_id", "area_id", "parent_id", "title", "notes", "status", "priority", "do_at", "has_time", "when_slot", "deadline_at", "energy", "estimate_min", "reminder_at", "rrule", "top3_date", "urgent", "sort", "done_at", "goal_id", "next_id") SELECT "id", "created_at", "updated_at", "deleted_at", "project_id", "area_id", "parent_id", "title", "notes", "status", "priority", "do_at", "has_time", "when_slot", "deadline_at", "energy", "estimate_min", "reminder_at", "rrule", "top3_date", "urgent", "sort", "done_at", "goal_id", "next_id" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
CREATE INDEX `tasks_status_do_at_idx` ON `tasks` (`status`,`do_at`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `tasks_top3_idx` ON `tasks` (`top3_date`);--> statement-breakpoint
CREATE INDEX `tasks_done_at_idx` ON `tasks` (`done_at`);--> statement-breakpoint
CREATE INDEX `tasks_updated_at_idx` ON `tasks` (`updated_at`);--> statement-breakpoint
CREATE TABLE `__new_time_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`task_id` text,
	`area_id` text,
	`project_id` text,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`source` text DEFAULT 'manual' NOT NULL,
	`billable` integer DEFAULT false NOT NULL,
	`note` text,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "time_entries_source_check" CHECK("source" IN ('timer', 'focus', 'manual')),
	CONSTRAINT "time_entries_range_check" CHECK("ended_at" >= "started_at")
);
--> statement-breakpoint
INSERT INTO `__new_time_entries`("id", "created_at", "updated_at", "deleted_at", "task_id", "area_id", "project_id", "started_at", "ended_at", "source", "billable", "note") SELECT "id", "created_at", "updated_at", "deleted_at", "task_id", "area_id", "project_id", "started_at", "ended_at", "source", "billable", "note" FROM `time_entries`;--> statement-breakpoint
DROP TABLE `time_entries`;--> statement-breakpoint
ALTER TABLE `__new_time_entries` RENAME TO `time_entries`;--> statement-breakpoint
CREATE INDEX `time_entries_started_at_idx` ON `time_entries` (`started_at`);