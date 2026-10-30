-- #164: each booking gets the secret of its cancel link. SQLite cannot add a NOT NULL column with no default, so
-- rebuild the table; an old row gets 32 random bytes (hex) as its token.
CREATE TABLE `__new_bookings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`offer_id` integer NOT NULL,
	`start` integer NOT NULL,
	`end` integer NOT NULL,
	`status` text DEFAULT 'requested' NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`locale` text NOT NULL,
	`created_at` integer NOT NULL,
	`paid_at` integer,
	`reminded_at` integer,
	`tikkie_url` text,
	`cancel_token` text NOT NULL,
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bookings_status" CHECK("__new_bookings"."status" IN ('requested', 'approved', 'declined', 'cancelled')),
	CONSTRAINT "bookings_range" CHECK("__new_bookings"."end" > "__new_bookings"."start")
);
--> statement-breakpoint
INSERT INTO `__new_bookings`("id", "offer_id", "start", "end", "status", "name", "email", "phone", "locale", "created_at", "paid_at", "reminded_at", "tikkie_url", "cancel_token") SELECT "id", "offer_id", "start", "end", "status", "name", "email", "phone", "locale", "created_at", "paid_at", "reminded_at", "tikkie_url", lower(hex(randomblob(32))) FROM `bookings`;--> statement-breakpoint
DROP TABLE `bookings`;--> statement-breakpoint
ALTER TABLE `__new_bookings` RENAME TO `bookings`;--> statement-breakpoint
CREATE INDEX `bookings_start_idx` ON `bookings` (`start`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookings_cancel_token_idx` ON `bookings` (`cancel_token`);
