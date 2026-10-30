CREATE TABLE `bookings` (
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
	FOREIGN KEY (`offer_id`) REFERENCES `offers`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "bookings_status" CHECK("bookings"."status" IN ('requested', 'approved', 'declined', 'cancelled')),
	CONSTRAINT "bookings_range" CHECK("bookings"."end" > "bookings"."start")
);
--> statement-breakpoint
CREATE INDEX `bookings_start_idx` ON `bookings` (`start`);