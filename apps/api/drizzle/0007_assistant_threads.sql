CREATE TABLE `assistant_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`memo` text,
	`cards` text,
	`actions` text,
	`rating` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`thread_id`) REFERENCES `assistant_threads`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "assistant_messages_role_check" CHECK("role" IN ('user', 'assistant')),
	CONSTRAINT "assistant_messages_rating_check" CHECK("rating" IN ('up', 'down'))
);
--> statement-breakpoint
CREATE INDEX `assistant_messages_thread_idx` ON `assistant_messages` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `assistant_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`title` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_threads_updated_at_idx` ON `assistant_threads` (`updated_at`);