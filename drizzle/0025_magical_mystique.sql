CREATE TABLE `booking_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`booking_id` integer NOT NULL,
	`at` integer NOT NULL,
	`kind` text NOT NULL,
	`by` text NOT NULL,
	`from_start` integer,
	FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `booking_events_booking_id_idx` ON `booking_events` (`booking_id`);