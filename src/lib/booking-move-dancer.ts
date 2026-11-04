// The move of a waiting request by the dancer with the link of the email (#648, epic #646). Only a `requested`
// or `approved` booking moves; the moved booking waits for Nina again (Nina's answer B on #647, #649).
import type { Db } from "../db";
import { type Booking, moveBookingToRequest } from "../db/bookings";
import type { Offer } from "../db/offers";
import { cancelLink } from "./booking-cancel";

/** What the move page shows for a token. `open`: the free times. The other states move nothing and say why. */
export type MoveLink =
  | { state: "open" | "approved" | "cancelled" | "declined" | "started"; booking: Booking; offer: Offer }
  | { state: "not-found" };

/** The booking of `token` and its move state at `now`: the states of `cancelLink()`. */
export function moveLink(db: Db, token: string, now = Date.now()): MoveLink {
  return cancelLink(db, token, now);
}

export type MoveByDancerResult =
  | { ok: true; booking: Booking; from: { start: number; end: number }; wasApproved: boolean }
  | { ok: false; state: Exclude<MoveLink["state"], "open"> | "taken" };

/**
 * Move the request of `token` to `to` (UTC milliseconds) when its state is `open`. `moveBooking()` checks the free
 * time again in one transaction: a time that another request took meanwhile gives `taken`.
 */
export function moveByDancer(db: Db, token: string, to: number, now = Date.now()): MoveByDancerResult {
  const link = moveLink(db, token, now);
  if (link.state !== "open") return { ok: false, state: link.state };
  const result = moveBookingToRequest(db, link.booking.id, to, { now });
  if (result.ok) return { ...result, wasApproved: link.booking.status === "approved" };
  if (result.reason === "taken" || result.reason === "notSlot") return { ok: false, state: "taken" };
  if (result.reason === "started") return { ok: false, state: "started" };
  return { ok: false, state: "cancelled" };
}
