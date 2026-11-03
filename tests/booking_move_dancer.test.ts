// The move of a waiting request by the dancer with the link (#648): the states of the link, the move, a taken time,
// and the push to Nina at the end of summer time.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { busyRanges, cancelBooking, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { moveByDancer, moveLink } from "../src/lib/booking-move-dancer";
import { movePush } from "../src/lib/booking-push";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const NOW = at("2026-10-20T12:00");

function setup(db: Db = openDb(":memory:")) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const request = (start: number, email = "ana@example.com") => {
    const r = requestBooking(
      db,
      { offerId: offer.id, start, end: start + 3_600_000, name: "Ana", email, phone: "+31 6 1234 5678", locale: "nl" },
      { now: NOW },
    );
    if (!r.ok) throw new Error("the request must be stored");
    return r.booking;
  };
  return { db, offer, booking: request(at("2026-11-07T14:00")), request };
}

test("moveLink gives each state", () => {
  const { db, booking, request } = setup();
  expect(moveLink(db, booking.cancelToken, NOW).state).toBe("open");
  expect(moveLink(db, booking.cancelToken, booking.start).state).toBe("started");
  expect(moveLink(db, "x".repeat(43), NOW).state).toBe("not-found");
  expect(moveLink(db, "short", NOW).state).toBe("not-found");
  const approved = request(at("2026-11-07T16:00"));
  decideBooking(db, approved.id, "approved", null, NOW);
  expect(moveLink(db, approved.cancelToken, NOW).state).toBe("open");
  const declined = request(at("2026-11-07T18:00"));
  decideBooking(db, declined.id, "declined", null, NOW);
  expect(moveLink(db, declined.cancelToken, NOW).state).toBe("declined");
  cancelBooking(db, booking.id);
  expect(moveLink(db, booking.cancelToken, NOW).state).toBe("cancelled");
});

test("moveByDancer moves a request, which still waits, and frees the old time", () => {
  const { db, booking } = setup();
  const to = at("2026-11-08T11:00");
  const result = moveByDancer(db, booking.cancelToken, to, NOW);
  if (!result.ok) throw new Error(`the move must work: ${result.state}`);
  expect(result.booking.start).toBe(to);
  expect(result.booking.status).toBe("requested");
  expect(result.from.start).toBe(booking.start);
  expect(busyRanges(db, booking.start, booking.end)).toHaveLength(0);
  expect(busyRanges(db, to, to + 3_600_000)).toHaveLength(1);
});

test("moveByDancer refuses a taken time, a started booking and a wrong token", () => {
  const { db, booking, request } = setup();
  const other = request(at("2026-11-08T11:00"), "bo@example.com");
  expect(moveByDancer(db, booking.cancelToken, other.start, NOW)).toEqual({ ok: false, state: "taken" });
  expect(moveByDancer(db, booking.cancelToken, at("2026-11-08T11:00"), booking.start)).toEqual({
    ok: false,
    state: "started",
  });
  expect(moveByDancer(db, "y".repeat(43), at("2026-11-08T15:00"), NOW)).toEqual({ ok: false, state: "not-found" });
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.start).toBe(booking.start);
});

test("the push names the old and the new time in Amsterdam time at the end of summer time", () => {
  const { booking } = setup();
  // Sunday 2026-10-25 10:00 CET is 09:00 UTC; the old time 2026-10-24 10:00 CEST is 08:00 UTC.
  const moved = { ...booking, start: at("2026-10-25T10:00") };
  const push = movePush(moved, { start: at("2026-10-24T10:00") }, "en");
  expect(push.title).toBe("Request moved");
  expect(push.body).toMatch(/^Ana moved the request from Oct 24, 2026, 10:00 AM to Oct 25, 2026, 10:00 AM\.$/);
  expect(push.url).toBe("/studio/week?start=2026-10-19");
  expect(movePush(moved, { start: at("2026-10-24T10:00") }, "nl").body).toContain("10:00");
});
