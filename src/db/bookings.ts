// The booking requests of dancers (#34). A `requested` or `approved` booking holds its time.
import { and, eq, gt, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { routing } from "../i18n/routing";
import { notBefore } from "../lib/booking-notice";
import { classRanges } from "../lib/class-ranges";
import { type OpenRange, openRanges, TIME_ZONE } from "../lib/hours";
import { getHoursRule } from "../lib/hours-store";
import { freeSlots } from "../lib/slots";
import { listBlocks } from "./blocks";
import { listClassTimes } from "./classes";
import type { Db } from "./index";
import type { Offer } from "./offers";
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

/**
 * The `start`..`end` ranges that overlap `from`..`to`, for `freeSlots()`: the `requested` and `approved` bookings, and
 * the blocks of Nina (#323, `listBlocks()`). Both the booking page and `requestBooking()` refuse a busy time, so a block
 * is refused there too; removing a block frees its time again.
 */
export function busyRanges(db: Db, from: number, to: number): OpenRange[] {
  const booked = db
    .select({ start: bookings.start, end: bookings.end })
    .from(bookings)
    .where(and(inArray(bookings.status, HOLDING), lt(bookings.start, to), gt(bookings.end, from)))
    .all();
  const blocked = listBlocks(db, from, to).map((b) => ({ start: b.start, end: b.end }));
  return [...booked, ...blocked].sort((a, b) => a.start - b.start);
}

/**
 * Store a booking request with status `requested`. The start and the end must be a free slot of a visible offer in
 * Nina's hours, at `notBefore(now)` or later. One `BEGIN IMMEDIATE` transaction checks and inserts, so that two requests at the
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
      const slots = freeSlots(open, [], offer.minutes, { notBefore: notBefore(now) });
      if (!slots.some((s) => s.start === start && s.end === end)) return { ok: false, reason: "notSlot" };
      // A class uses the room: a request never takes its time (#99).
      const classes = classRanges(listClassTimes(db, { visibleOnly: true }), date, date);
      const inClass = classes.some((c) => c.start < end && start < c.end);
      if (inClass || busyRanges(db, start, end).length > 0) return { ok: false, reason: "taken" };
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

export type DecideResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not-found" | "not-requested" | "started" };

/**
 * Nina approves or declines a `requested` booking. One `UPDATE` changes the status only while it is `requested`: a
 * second decision gets `not-requested` and changes nothing. A declined booking no longer holds its time.
 * A request whose start is at or before `now` gets `started` and changes nothing (#341).
 * `tikkieUrl`: the payment link of an approval (#142), checked by `tikkieLink()` of `src/lib/tikkie.ts`.
 */
export function decideBooking(
  db: Db,
  id: number,
  decision: "approved" | "declined",
  tikkieUrl: string | null = null,
  now = Date.now(),
): DecideResult {
  const booking = db
    .update(bookings)
    .set({
      status: decision,
      tikkieUrl: decision === "approved" ? tikkieUrl : null,
      approvedAt: decision === "approved" ? Date.now() : null,
    })
    .where(and(eq(bookings.id, id), eq(bookings.status, "requested"), gt(bookings.start, now)))
    .returning()
    .get();
  if (booking) return { ok: true, booking };
  const exists = db
    .select({ status: bookings.status, start: bookings.start })
    .from(bookings)
    .where(eq(bookings.id, id))
    .get();
  if (!exists) return { ok: false, reason: "not-found" };
  if (exists.status === "requested" && exists.start <= now) return { ok: false, reason: "started" };
  return { ok: false, reason: "not-requested" };
}

export type CancelResult = { ok: true; booking: Booking } | { ok: false; reason: "not-found" | "not-active" };

/**
 * Cancel a `requested` or `approved` booking (#159): it gets `cancelled` and frees its time, as `busyRanges()` counts
 * only the holding statuses. A paid booking keeps `paidAt` (the refund waits for #139).
 */
export function cancelBooking(db: Db, id: number): CancelResult {
  const booking = db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), inArray(bookings.status, HOLDING)))
    .returning()
    .get();
  if (booking) return { ok: true, booking };
  const exists = db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id)).get();
  return { ok: false, reason: exists ? "not-active" : "not-found" };
}

export type MarkPaidResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not-found" | "not-approved" | "already-paid" };

/**
 * Store that an `approved` booking is paid (#140). One `UPDATE` sets `paidAt` only while the booking is `approved` and
 * not yet paid: a second call (a provider can call its webhook twice) gets `already-paid` and keeps the first time.
 */
export function markPaid(db: Db, id: number, now = Date.now()): MarkPaidResult {
  const booking = db
    .update(bookings)
    .set({ paidAt: now })
    .where(and(eq(bookings.id, id), eq(bookings.status, "approved"), isNull(bookings.paidAt)))
    .returning()
    .get();
  if (booking) return { ok: true, booking };
  const exists = db.select().from(bookings).where(eq(bookings.id, id)).get();
  if (!exists) return { ok: false, reason: "not-found" };
  if (exists.status !== "approved") return { ok: false, reason: "not-approved" };
  return { ok: false, reason: "already-paid" };
}

export type UnmarkPaidResult = { ok: true; booking: Booking } | { ok: false; reason: "not-found" | "not-paid" };

/** Clear `paidAt` after a wrong tap on "Paid" (#143). A second call gets `not-paid` and changes nothing. */
export function unmarkPaid(db: Db, id: number): UnmarkPaidResult {
  const booking = db
    .update(bookings)
    .set({ paidAt: null })
    .where(and(eq(bookings.id, id), isNotNull(bookings.paidAt)))
    .returning()
    .get();
  if (booking) return { ok: true, booking };
  const exists = db.select({ id: bookings.id }).from(bookings).where(eq(bookings.id, id)).get();
  return { ok: false, reason: exists ? "not-paid" : "not-found" };
}

/** The bookings with one of `statuses` that overlap `from`..`to`, with their offer, by start: the week page and the calendar. */
export function listBookings(
  db: Db,
  from: number,
  to: number,
  statuses: readonly Booking["status"][],
): { booking: Booking; offer: Offer }[] {
  if (statuses.length === 0) return [];
  return db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(inArray(bookings.status, statuses), lt(bookings.start, to), gt(bookings.end, from)))
    .orderBy(bookings.start)
    .all();
}

/** The `requested` bookings with their offer, by start: the requests that wait for Nina (not those already started, #341). */
export function listOpenRequests(db: Db, now = Date.now()): { booking: Booking; offer: Offer }[] {
  return db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(and(eq(bookings.status, "requested"), gt(bookings.start, now)))
    .orderBy(bookings.start)
    .all();
}
