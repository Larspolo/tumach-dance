CREATE TABLE `offers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`minutes` integer NOT NULL,
	`price_cents` integer NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`position` integer NOT NULL,
	CONSTRAINT "offers_kind" CHECK("offers"."kind" IN ('lesson', 'rental')),
	CONSTRAINT "offers_minutes" CHECK("offers"."minutes" > 0),
	CONSTRAINT "offers_price" CHECK("offers"."price_cents" >= 0)
);
