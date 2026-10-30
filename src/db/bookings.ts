// The booking requests of dancers (#34). A `requested` or `approved` booking holds its time.
import { and, eq, gt, inArray, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { routing } from "../i18n/routing";
import { type OpenRange, openRanges, TIME_ZONE } from "../lib/hours";
import { getHoursRule } from "../lib/hours-store";
import { freeSlots } from "../lib/slots";
import type { Db } from "./index";
import { bookings, offers } from "./schema";

export type Booking = typeof bookings.$inferSelect;

/** The form of a dancer. The server checks each field: never trust the times of the form. */
export type BookingInput = {
  offerId: number;
  start: number;
  end: number;
  name: string;
  email: string;
  phone: string;
  locale: string;
};

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "invalid"; field: "offerId" | "name" | "email" | "phone" | "locale" }
  | { ok: false; reason: "notSlot" }
  | { ok: false; reason: "taken" };

/** The statuses that hold their time. */
const HOLDING = ["requested", "approved"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[\d\s()./-]+$/;

/** The first field that is wrong, with the clean values. Simple checks (P1): the email to Nina is the real check. */
function clean(
  input: BookingInput,
): { field: "name" | "email" | "phone" | "locale" } | { name: string; email: string; phone: string } {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const digits = phone.replace(/\D/g, "").length;
  if (!name || name.length > 100) return { field: "name" };
  if (email.length > 200 || !EMAIL.test(email)) return { field: "email" };
  if (!PHONE.test(phone) || digits < 6 || digits > 15) return { field: "phone" };
  if (!(routing.locales as readonly string[]).includes(input.locale)) return { field: "locale" };
  return { name, email, phone };
}

/** The `start`..`end` ranges of the `requested` and `approved` bookings that overlap `from`..`to`, for `freeSlots()`. */
export function busyRanges(db: Db, from: number, to: number): OpenRange[] {
  return db
    .select({ start: bookings.start, end: bookings.end })
    .from(bookings)
    .where(and(inArray(bookings.status, HOLDING), lt(bookings.start, to), gt(bookings.end, from)))
    .orderBy(bookings.start)
    .all();
}

/**
 * Store a booking request with status `requested`. The start and the end must be a free slot of a visible offer in
 * Nina's hours, at `now` or later. One `BEGIN IMMEDIATE` transaction checks and inserts, so that two requests at the
 * same moment (also from two connections) never both get an overlapping time: the second gets `taken`.
 */
export function requestBooking(
  db: Db,
  input: BookingInput,
  { now = Date.now() }: { now?: number } = {},
): BookingResult {
  const fields = clean(input);
  if ("field" in fields) return { ok: false, reason: "invalid", field: fields.field };
  if (!Number.isInteger(input.start) || !Number.isInteger(input.end)) return { ok: false, reason: "notSlot" };
  const { start, end } = input;
  // better-sqlite3 is synchronous: the reads of `db` in the callback run in the transaction of its one connection.
  return db.transaction(
    (tx): BookingResult => {
      const offer = tx.select().from(offers).where(eq(offers.id, input.offerId)).get();
      if (!offer?.visible) return { ok: false, reason: "invalid", field: "offerId" };
      const date = DateTime.fromMillis(start, { zone: TIME_ZONE }).toISODate();
      if (!date) return { ok: false, reason: "notSlot" };
      const open = openRanges(getHoursRule(db), date, date);
      const slots = freeSlots(open, [], offer.minutes, { notBefore: now });
      if (!slots.some((s) => s.start === start && s.end === end)) return { ok: false, reason: "notSlot" };
      if (busyRanges(db, start, end).length > 0) return { ok: false, reason: "taken" };
      const booking = tx
        .insert(bookings)
        .values({ offerId: offer.id, start, end, status: "requested", ...fields, locale: input.locale, createdAt: now })
        .returning()
        .get();
      return { ok: true, booking };
    },
    { behavior: "immediate" },
  );
}
