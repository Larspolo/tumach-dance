CREATE TABLE `notified_questions` (
	`number` integer PRIMARY KEY NOT NULL,
	`notified_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `push_subscriptions` ADD `locale` text DEFAULT 'en' NOT NULL;