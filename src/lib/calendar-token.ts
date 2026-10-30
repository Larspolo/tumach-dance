// The secret token of the calendar feed of Nina (#103): one row of `settings`, made at the first use.
import { randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { settings } from "../db/schema";

const KEY = "calendarToken";

function save(db: Db, token: string): string {
  const row = { key: KEY, value: JSON.stringify(token), updatedAt: Date.now() };
  db.insert(settings)
    .values(row)
    .onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } })
    .run();
  return token;
}

/** A new random token in place of the old one: the old feed address stops working. */
export function renewCalendarToken(db: Db): string {
  return save(db, randomBytes(24).toString("base64url"));
}

/** The token of the feed address; the first call makes it. */
export function getCalendarToken(db: Db): string {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row ? (JSON.parse(row.value) as string) : renewCalendarToken(db);
}

/** True when `token` is the current token, in a time that does not depend on the token. */
export function isCalendarToken(db: Db, token: string): boolean {
  const want = Buffer.from(getCalendarToken(db));
  const got = Buffer.from(token);
  return got.length === want.length && timingSafeEqual(got, want);
}
