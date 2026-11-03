// The tile "Bookings" of the studio home shows how many requests wait for Nina (#659): the count has the same
// condition as the list of open requests (`requested` and not yet started).
import { DateTime } from "luxon";
import { beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, cancelBooking, countOpenRequests, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

let db: Db;

beforeEach(() => {
  db = openDb(":memory:");
});

let count = 0;
function book(start: string, decision?: "approved" | "declined" | "cancelled"): number {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  // One email per request: the limit per email address and day (#541) would refuse a second one.
  count += 1;
  const input: BookingInput = {
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name: "Ana",
    email: `dancer${count}@example.com`,
    phone: "+31 6 1234 5678",
    locale: "en",
  };
  const r = requestBooking(db, input, { now: NOW });
  if (!r.ok) throw new Error(`no booking: ${r.reason}`);
  if (decision === "cancelled") cancelBooking(db, r.booking.id, "nina");
  else if (decision) decideBooking(db, r.booking.id, decision, null, NOW);
  return r.booking.id;
}

test("two open requests give a count of 2", () => {
  book("2026-10-25T19:00");
  book("2026-10-26T19:00");
  expect(countOpenRequests(db, NOW)).toBe(2);
});

test("a request whose start has passed, an approved, a declined and a cancelled booking do not count", () => {
  book("2026-10-25T19:00");
  book("2026-10-26T19:00");
  // Open at NOW, but its start is over when Nina looks on the 22nd.
  book("2026-10-21T19:00");
  book("2026-10-27T19:00", "approved");
  book("2026-10-28T19:00", "declined");
  book("2026-10-30T19:00", "cancelled");
  expect(countOpenRequests(db, at("2026-10-22T08:00"))).toBe(2);
});

test("no requests give a count of 0", () => {
  expect(countOpenRequests(db, NOW)).toBe(0);
});
