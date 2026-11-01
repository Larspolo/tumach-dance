CREATE TABLE `blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT "blocks_range" CHECK("blocks"."end" > "blocks"."start")
);
--> statement-breakpoint
CREATE INDEX `blocks_start_idx` ON `blocks` (`start`);