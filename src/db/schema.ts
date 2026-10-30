// The database schema (#14). Drizzle Kit makes the migrations in `drizzle/` from this file: `npm run db:generate`.
// Times: each instant is an integer of epoch milliseconds in UTC (as `OpenRange` of `src/lib/hours.ts`), one form
// for all tables. The site shows it in Europe/Amsterdam time.
import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The settings of the site: one row per key, the value as JSON text. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  /** UTC, epoch milliseconds. */
  updatedAt: integer("updated_at").notNull(),
});

/** The offers of the studio (#30). The name that dancers see comes from `messages/` by `kind` and `minutes`. */
export const offers = sqliteTable(
  "offers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    kind: text("kind", { enum: ["lesson", "rental"] }).notNull(),
    minutes: integer("minutes").notNull(),
    priceCents: integer("price_cents").notNull(),
    visible: integer("visible", { mode: "boolean" }).notNull().default(true),
    /** The order on the page: low first. */
    position: integer("position").notNull(),
  },
  (t) => [
    check("offers_kind", sql`${t.kind} IN ('lesson', 'rental')`),
    check("offers_minutes", sql`${t.minutes} > 0`),
    check("offers_price", sql`${t.priceCents} >= 0`),
  ],
);
