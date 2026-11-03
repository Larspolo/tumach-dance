// The move of an approved booking by the dancer (#649, Nina's answer B on #647): it waits for Nina again, the email
// says so, and a paid booking stays paid.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { decideBooking, markPaid, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { moveEmail } from "../src/lib/booking-email";
import { moveByDancer, moveLink } from "../src/lib/booking-move-dancer";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const NOW = at("2026-10-20T12:00");

function approvedBooking(paid = false) {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const start = at("2026-11-07T14:00");
  const r = requestBooking(
    db,
    {
      offerId: offer.id,
      start,
      end: start + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
    },
    { now: NOW },
  );
  if (!r.ok) throw new Error("the request must be stored");
  decideBooking(db, r.booking.id, "approved", null, NOW);
  if (paid) markPaid(db, r.booking.id, NOW);
  return { db, offer, booking: r.booking };
}

test("a moved approved booking is requested again and the email says that Nina approves the new time", () => {
  const { db, offer, booking } = approvedBooking();
  expect(moveLink(db, booking.cancelToken, NOW).state).toBe("open");
  const to = at("2026-11-08T11:00");
  const result = moveByDancer(db, booking.cancelToken, to, NOW);
  if (!result.ok) throw new Error(`the move must work: ${result.state}`);
  expect(result.wasApproved).toBe(true);
  expect(result.booking.status).toBe("requested");
  expect(result.booking.start).toBe(to);
  expect(result.booking.approvedAt).toBeNull();
  const email = moveEmail(result.booking, offer, result.from, "https://tumach.dance", true);
  expect(email.text).toContain("Nina approves the new time first.");
  expect(email.attachments).toBeUndefined();
});

test("a paid booking stays paid after the move", () => {
  const { db, booking } = approvedBooking(true);
  const result = moveByDancer(db, booking.cancelToken, at("2026-11-08T11:00"), NOW);
  if (!result.ok) throw new Error(`the move must work: ${result.state}`);
  expect(result.booking.status).toBe("requested");
  expect(result.booking.paidAt).toBe(NOW);
});

test("a moved request is not 'again'", () => {
  const { db } = approvedBooking();
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 1 });
  const start = at("2026-11-07T17:00");
  const r = requestBooking(
    db,
    {
      offerId: offer.id,
      start,
      end: start + 3_600_000,
      name: "Bo",
      email: "bo@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
    },
    { now: NOW },
  );
  if (!r.ok) throw new Error("the request must be stored");
  const result = moveByDancer(db, r.booking.cancelToken, at("2026-11-08T15:00"), NOW);
  expect(result.ok && result.wasApproved).toBe(false);
});
