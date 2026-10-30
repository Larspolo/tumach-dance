CREATE TABLE `class_times` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`class_id` integer NOT NULL,
	`weekday` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "class_times_range" CHECK("class_times"."to" > "class_times"."from")
);
--> statement-breakpoint
CREATE INDEX `class_times_class_id_idx` ON `class_times` (`class_id`);--> statement-breakpoint
CREATE TABLE `classes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`text` text NOT NULL,
	`for_whom` text NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`position` integer NOT NULL
);
