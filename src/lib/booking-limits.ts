// The limits of the booking requests that do not depend on the address of the visitor (#541). The bot check of
// `contact-spam.ts` stops a simple bot and limits one connection; a bot with many connections still gets past it. So
// `requestBooking()` also refuses a request when one email address has too many open requests, or when the whole site
// got too many requests in 24 hours: a bot can then hold only a few times and make the site send only a few emails.
// The counts come from the table `bookings` in the transaction of the request: no new table and no new library.
// The push to Nina of the day limit: `booking-limit-push.ts` (this file has no push: the database layer imports it).
import { and, eq, gt, sql } from "drizzle-orm";
import type { Db } from "../db";
import { bookings } from "../db/schema";

export const DAY_MS = 24 * 60 * 60_000;

const envNumber = (name: string, fallback: number) => {
  const raw = process.env[name];
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
};

/** The open requests (`requested`, start after now) of one email address. The browser tests set a higher value. */
export const openPerEmail = () => envNumber("BOOKING_OPEN_PER_EMAIL", 3);
/** The requests of all dancers in 24 hours. The browser tests set a higher value. */
export const requestsPerDay = () => envNumber("BOOKING_LIMIT_PER_DAY", 30);

/** `open`: the email address has too many open requests; `day`: the site got too many requests in 24 hours. */
export type BookingLimit = "open" | "day";

/** The limit that a new request of `email` at `now` passes, or null. `db` is the transaction of the request. */
export function bookingLimit(db: Db, email: string, now: number): BookingLimit | null {
  const count = (where: ReturnType<typeof and>) =>
    db.select({ n: sql<number>`count(*)` }).from(bookings).where(where).get()?.n ?? 0;
  const open = count(
    and(
      eq(bookings.status, "requested"),
      gt(bookings.start, now),
      sql`lower(${bookings.email}) = ${email.trim().toLowerCase()}`,
    ),
  );
  if (open >= openPerEmail()) return "open";
  if (count(gt(bookings.createdAt, now - DAY_MS)) >= requestsPerDay()) return "day";
  return null;
}
