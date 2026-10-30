CREATE TABLE `loaded_examples` (
	`question` integer NOT NULL,
	`name` text NOT NULL,
	`loaded_at` integer NOT NULL,
	PRIMARY KEY(`question`, `name`)
);
