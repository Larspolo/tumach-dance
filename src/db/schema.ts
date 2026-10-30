// The database schema (#14). Drizzle Kit makes the migrations in `drizzle/` from this file: `npm run db:generate`.
// Times: each instant is an integer of epoch milliseconds in UTC (as `OpenRange` of `src/lib/hours.ts`), one form
// for all tables. The site shows it in Europe/Amsterdam time.
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** The settings of the site: one row per key, the value as JSON text. */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  /** UTC, epoch milliseconds. */
  updatedAt: integer("updated_at").notNull(),
});
