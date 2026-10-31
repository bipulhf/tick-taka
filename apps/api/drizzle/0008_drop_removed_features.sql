DROP TABLE `shopping_items`;--> statement-breakpoint
DROP TABLE `sms_imports`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	`estimate_min` integer,
	`reminder_at` integer,
	`rrule` text,
	`top3_date` text,
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
	CONSTRAINT "tasks_estimate_check" CHECK("estimate_min" >= 0),
	CONSTRAINT "tasks_top3_date_check" CHECK("top3_date" GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
	CONSTRAINT "tasks_parent_self_check" CHECK("parent_id" <> "id")
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "created_at", "updated_at", "deleted_at", "project_id", "area_id", "parent_id", "title", "notes", "status", "priority", "do_at", "has_time", "when_slot", "deadline_at", "estimate_min", "reminder_at", "rrule", "top3_date", "sort", "done_at", "goal_id", "next_id") SELECT "id", "created_at", "updated_at", "deleted_at", "project_id", "area_id", "parent_id", "title", "notes", "status", "priority", "do_at", "has_time", "when_slot", "deadline_at", "estimate_min", "reminder_at", "rrule", "top3_date", "sort", "done_at", "goal_id", "next_id" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `tasks_status_do_at_idx` ON `tasks` (`status`,`do_at`);--> statement-breakpoint
CREATE INDEX `tasks_parent_idx` ON `tasks` (`parent_id`);--> statement-breakpoint
CREATE INDEX `tasks_top3_idx` ON `tasks` (`top3_date`);--> statement-breakpoint
CREATE INDEX `tasks_done_at_idx` ON `tasks` (`done_at`);--> statement-breakpoint
CREATE INDEX `tasks_updated_at_idx` ON `tasks` (`updated_at`);