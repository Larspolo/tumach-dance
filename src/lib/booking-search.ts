// The search of the bookings by a part of the name, the email or the phone, for Nina's studio app (#663, epic #662).
import { and, desc, eq, isNull, or, type SQL, sql } from "drizzle-orm";
import type { Db } from "@/db";
import type { Booking } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { bookings, offers } from "@/db/schema";
import { phoneDigits, phoneDigitsSql } from "@/lib/same-dancer";

/** A Dutch number written with the trunk 0 (`06 1234`) is the same as one with the country code (`+31 6 1234`). */
const countryCode = (digits: string) => (digits.startsWith("0") ? `31${digits.slice(1)}` : digits);

/** The phone digits of the column in the same form as `countryCode()`. */
function countryCodeSql(): SQL {
  const digits = phoneDigitsSql();
  return sql`(case when ${digits} like '0%' then '31' || substr(${digits}, 2) else ${digits} end)`;
}

/**
 * The bookings (all statuses, not removed) whose name or email contains `query` (any case), or whose phone digits
 * contain its digits when it has 3 or more digits. Newest first, at most `limit`, each with its offer. A query of less
 * than 2 characters finds nothing.
 */
export function searchBookings(
  db: Db,
  query: string,
  { limit = 30 }: { limit?: number } = {},
): { booking: Booking; offer: Offer }[] {
  const text = query.trim().toLowerCase();
  if (text.length < 2) return [];
  const conditions: SQL[] = [
    sql`instr(lower(${bookings.name}), ${text}) > 0`,
    sql`instr(lower(${bookings.email}), ${text}) > 0`,
  ];
  const digits = phoneDigits(text);
  if (digits.length >= 3) conditions.push(sql`instr(${countryCodeSql()}, ${countryCode(digits)}) > 0`);
  return db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(isNull(bookings.forgottenAt), or(...conditions)))
    .orderBy(desc(bookings.start))
    .limit(limit)
    .all();
}
