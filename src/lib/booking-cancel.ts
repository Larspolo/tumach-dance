// The cancel link of the dancer (#164): the secret token of a booking, and the rule of #163 (Nina's answer: a dancer
// cancels at any time before the start; a cancelled paid booking gets no refund).
import { eq } from "drizzle-orm";
import type { Db } from "../db";
import { type Booking, cancelBooking } from "../db/bookings";
import type { Offer } from "../db/offers";
import { bookings, offers } from "../db/schema";

/** How many hours before the start a dancer can still cancel (#163): the one place to change it. */
export const DANCER_CANCEL_HOURS = 0;

/** True when a dancer can still cancel a booking that starts at `start` (UTC milliseconds) at the instant `now`. */
export function dancerCanCancel(start: number, now: number): boolean {
  return now < start - DANCER_CANCEL_HOURS * 3_600_000;
}

/** What the cancel page shows for a token. `open`: the button. The other states cancel nothing and say why. */
export type CancelLink =
  | { state: "open" | "cancelled" | "declined" | "started"; booking: Booking; offer: Offer }
  | { state: "not-found" };

/** A token of a link: base64url (new bookings) or hex (the rows of the migration), never an empty or long text. */
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

/** The booking of `token`, by the unique index of `cancel_token`, and its state at `now`. */
export function cancelLink(db: Db, token: string, now = Date.now()): CancelLink {
  if (!TOKEN.test(token)) return { state: "not-found" };
  const row = db
    .select({ booking: bookings, offer: offers })
    .from(bookings)
    .innerJoin(offers, eq(offers.id, bookings.offerId))
    .where(eq(bookings.cancelToken, token))
    .get();
  if (!row) return { state: "not-found" };
  const { status, start } = row.booking;
  if (status === "cancelled" || status === "declined") return { state: status, ...row };
  if (!dancerCanCancel(start, now)) return { state: "started", ...row };
  return { state: "open", ...row };
}

/**
 * Cancel the booking of `token` when its state is `open`. better-sqlite3 is synchronous: no other request runs between
 * the check and the `UPDATE` of `cancelBooking()`, which changes only a `requested` or `approved` booking.
 */
export function cancelByDancer(
  db: Db,
  token: string,
  now = Date.now(),
): { ok: true; booking: Booking } | { ok: false; state: Exclude<CancelLink["state"], "open"> } {
  const link = cancelLink(db, token, now);
  if (link.state !== "open") return { ok: false, state: link.state };
  const result = cancelBooking(db, link.booking.id);
  return result.ok ? { ok: true, booking: result.booking } : { ok: false, state: "cancelled" };
}

/** The address of the cancel page of `booking` on the site `origin` (for example `https://tumach.dance`). */
export function cancelUrl(origin: string, booking: Booking): string {
  const url = new URL(`/${booking.locale}/booking/cancel`, origin);
  url.searchParams.set("token", booking.cancelToken);
  return url.toString();
}
