ALTER TABLE `bookings` ADD `price_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `bookings` SET `price_cents` = (SELECT `price_cents` FROM `offers` WHERE `offers`.`id` = `bookings`.`offer_id`);
