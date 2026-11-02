// The booking requests of dancers (#34). A `requested` or `approved` booking holds its time.
import { and, eq, gt, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { routing } from "../i18n/routing";
import { type BookingLimit, bookingLimit } from "../lib/booking-limits";
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
  /** An optional note to Nina, at most 500 characters (#387). Empty = `null`. */
  note?: string | null;
  locale: string;
};

export type BookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "invalid"; field: "offerId" | "name" | "email" | "phone" | "note" | "locale" }
  | { ok: false; reason: "notSlot" }
  | { ok: false; reason: "taken" }
  | { ok: false; reason: "limit"; limit: BookingLimit };

/** The statuses that hold their time. */
const HOLDING = ["requested", "approved"] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** The longest note of a dancer (#387). */
export const NOTE_MAX = 500;
const PHONE = /^\+?[\d\s()./-]+$/;

/** The first field that is wrong, with the clean values. Simple checks (P1): the email to Nina is the real check. */
function clean(
  input: BookingInput,
):
  | { field: "name" | "email" | "phone" | "note" | "locale" }
  | { name: string; email: string; phone: string; note: string | null } {
  const name = String(input.name ?? "").trim();
  const email = String(input.email ?? "").trim();
  const phone = String(input.phone ?? "").trim();
  const note = String(input.note ?? "").trim();
  const digits = phone.replace(/\D/g, "").length;
  if (!name || name.length > 100) return { field: "name" };
  if (email.length > 200 || !EMAIL.test(email)) return { field: "email" };
  if (!PHONE.test(phone) || digits < 6 || digits > 15) return { field: "phone" };
  if (note.length > NOTE_MAX) return { field: "note" };
  if (!(routing.locales as readonly string[]).includes(input.locale)) return { field: "locale" };
  return { name, email, phone, note: note || null };
}

/**
 * The `start`..`end` ranges that overlap `from`..`to`, for `freeSlots()`: the `requested` and `approved` bookings, and
 * the blocks of Nina (#323, `listBlocks()`). Both the booking page and `requestBooking()` refuse a busy time, so a block
 * is refused there too; removing a block frees its time again. `except`: a booking that does not count (its move, #409).
 */
export function busyRanges(db: Db, from: number, to: number, { except }: { except?: number } = {}): OpenRange[] {
  const booked = db
    .select({ start: bookings.start, end: bookings.end })
    .from(bookings)
    .where(
      and(
        inArray(bookings.status, HOLDING),
        lt(bookings.start, to),
        gt(bookings.end, from),
        except === undefined ? undefined : ne(bookings.id, except),
      ),
    )
    .all();
  const blocked = listBlocks(db, from, to).map((b) => ({ start: b.start, end: b.end }));
  return [...booked, ...blocked].sort((a, b) => a.start - b.start);
}

/**
 * Store a booking request with status `requested`. The start and the end must be a free slot of a visible offer in
 * Nina's hours, at `notBefore(now)` or later. One `BEGIN IMMEDIATE` transaction checks and inserts, so that two requests at the
 * same moment (also from two connections) never both get an overlapping time: the second gets `taken`. A request over a
 * limit of `bookingLimit()` (#541) gets `limit` and holds no time.
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
      // The limits of an email address and of the day (#541): a bot with many connections holds only a few times.
      const limit = bookingLimit(db, fields.email, now);
      if (limit) return { ok: false, reason: "limit", limit };
      const booking = tx
        .insert(bookings)
        .values({
          offerId: offer.id,
          priceCents: offer.priceCents,
          start,
          end,
          status: "requested",
          ...fields,
          locale: input.locale,
          createdAt: now,
        })
        .returning()
        .get();
      return { ok: true, booking };
    },
    { behavior: "immediate" },
  );
}

/** `from`: the old time of the booking, for the email and the push of the move (epic #406). */
export type MoveResult =
  | { ok: true; booking: Booking; from: { start: number; end: number } }
  | { ok: false; reason: "not-found" | "not-open" | "started" | "notSlot" | "taken" };

/**
 * Move a `requested` or `approved` booking whose start is after `now` to `start` (#409). The new end is `start` plus
 * the minutes of its offer, also when the offer is hidden now. The new time must be a free slot as in
 * `requestBooking()`; the old time of the booking itself does not count as busy. One `BEGIN IMMEDIATE` transaction
 * checks and updates, so that a request or another move at the same moment never gets an overlapping time. A move
 * clears `remindedAt` (the reminder goes again for the new day) and adds one to `calendarSequence`.
 */
export function moveBooking(
  db: Db,
  id: number,
  start: number,
  { now = Date.now() }: { now?: number } = {},
): MoveResult {
  return db.transaction(
    (tx): MoveResult => {
      const row = tx
        .select({ booking: bookings, offer: offers })
        .from(bookings)
        .innerJoin(offers, eq(offers.id, bookings.offerId))
        .where(eq(bookings.id, id))
        .get();
      if (!row) return { ok: false, reason: "not-found" };
      const { booking: before, offer } = row;
      if (!(HOLDING as readonly string[]).includes(before.status)) return { ok: false, reason: "not-open" };
      if (before.start <= now) return { ok: false, reason: "started" };
      if (!Number.isInteger(start)) return { ok: false, reason: "notSlot" };
      const end = start + offer.minutes * 60_000;
      const date = DateTime.fromMillis(start, { zone: TIME_ZONE }).toISODate();
      if (!date) return { ok: false, reason: "notSlot" };
      const open = openRanges(getHoursRule(db), date, date);
      const slots = freeSlots(open, [], offer.minutes, { notBefore: notBefore(now) });
      if (!slots.some((s) => s.start === start && s.end === end)) return { ok: false, reason: "notSlot" };
      const classes = classRanges(listClassTimes(db, { visibleOnly: true }), date, date);
      const inClass = classes.some((c) => c.start < end && start < c.end);
      if (inClass || busyRanges(db, start, end, { except: id }).length > 0) return { ok: false, reason: "taken" };
      const booking = tx
        .update(bookings)
        .set({ start, end, remindedAt: null, calendarSequence: sql`${bookings.calendarSequence} + 1` })
        .where(eq(bookings.id, id))
        .returning()
        .get();
      return { ok: true, booking, from: { start: before.start, end: before.end } };
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
      decidedAt: now,
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

/** The time after a tap on Approve or Decline in which Nina can undo it; the decision email goes after it (#572). */
export const UNDO_MS = 60_000;

/**
 * The bookings whose dancer has the decision email, or never waits for one: a decision before #572 (no `decidedAt`).
 * The reminders and the payment reminder leave out the others, so no reminder comes before the decision email.
 */
export const decisionTold = or(isNull(bookings.decidedAt), isNotNull(bookings.decisionMailedAt));

export type UndoResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "not-found" | "not-decided" | "sent" | "started" | "taken" };

/**
 * Undo Nina's decision of the last `UNDO_MS` (#572): the booking is `requested` again, and the dancer gets no
 * decision email. `sent`: the email went out, or the undo time ended. `taken`: a declined time that another booking,
 * a block or a class took in the meantime. One `BEGIN IMMEDIATE` transaction checks and updates; the claim of the
 * email (`claimDueDecisions()`) is one `UPDATE` that needs `decidedAt` and a `null` `decisionMailedAt`, so an undo
 * and a send never both happen.
 */
export function undoDecision(db: Db, id: number, now = Date.now()): UndoResult {
  return db.transaction(
    (tx): UndoResult => {
      const before = tx.select().from(bookings).where(eq(bookings.id, id)).get();
      if (!before) return { ok: false, reason: "not-found" };
      if ((before.status !== "approved" && before.status !== "declined") || before.decidedAt === null) {
        return { ok: false, reason: "not-decided" };
      }
      if (before.decisionMailedAt !== null || now - before.decidedAt >= UNDO_MS) return { ok: false, reason: "sent" };
      if (before.start <= now) return { ok: false, reason: "started" };
      const date = DateTime.fromMillis(before.start, { zone: TIME_ZONE }).toISODate();
      const classes = date ? classRanges(listClassTimes(db, { visibleOnly: true }), date, date) : [];
      const inClass = classes.some((c) => c.start < before.end && before.start < c.end);
      if (inClass || busyRanges(db, before.start, before.end, { except: id }).length > 0) {
        return { ok: false, reason: "taken" };
      }
      const booking = tx
        .update(bookings)
        .set({ status: "requested", approvedAt: null, tikkieUrl: null, decidedAt: null })
        .where(and(eq(bookings.id, id), isNull(bookings.decisionMailedAt)))
        .returning()
        .get();
      return booking ? { ok: true, booking } : { ok: false, reason: "sent" };
    },
    { behavior: "immediate" },
  );
}

/**
 * Claim the decisions whose undo time ended and whose email did not go (#572): one `UPDATE` sets `decisionMailedAt`,
 * so two callers at the same moment (the short timer of the tap and the booking timer) never claim one booking twice.
 * A booking that Nina cancelled in the undo time is not claimed: the dancer gets only the cancel email.
 */
export function claimDueDecisions(db: Db, now = Date.now()): Booking[] {
  return db
    .update(bookings)
    .set({ decisionMailedAt: now })
    .where(
      and(
        inArray(bookings.status, ["approved", "declined"]),
        isNotNull(bookings.decidedAt),
        lte(bookings.decidedAt, now - UNDO_MS),
        isNull(bookings.decisionMailedAt),
      ),
    )
    .returning()
    .all();
}

/** `wasApproved`: the booking was approved before the cancel (its calendar file reached the dancer, #386). */
export type CancelResult =
  | { ok: true; booking: Booking; wasApproved: boolean }
  | { ok: false; reason: "not-found" | "not-active" };

/**
 * Cancel a `requested` or `approved` booking (#159): it gets `cancelled` and frees its time, as `busyRanges()` counts
 * only the holding statuses. A paid booking keeps `paidAt` (the refund waits for #139).
 */
export function cancelBooking(db: Db, id: number): CancelResult {
  // better-sqlite3 is synchronous: the status read here is the one the `UPDATE` changes.
  const before = db.select({ status: bookings.status }).from(bookings).where(eq(bookings.id, id)).get();
  const booking = db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(and(eq(bookings.id, id), inArray(bookings.status, HOLDING)))
    .returning()
    .get();
  if (booking) return { ok: true, booking, wasApproved: before?.status === "approved" };
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

/** One `approved` booking with its offer (#535: the calendar file of Nina), or null. */
export function getApprovedBooking(db: Db, id: number): { booking: Booking; offer: Offer } | null {
  return (
    db
      .select({ booking: bookings, offer: offers })
      .from(bookings)
      .innerJoin(offers, eq(offers.id, bookings.offerId))
      .where(and(eq(bookings.id, id), eq(bookings.status, "approved")))
      .get() ?? null
  );
}
