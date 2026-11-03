// Book again (#724, epic #722): the token of a booking gives the offer and the fields of the dancer, for each status,
// and nothing for a wrong, unknown, hidden or forgotten booking. The address has the locale and the token only.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { type BookingInput, cancelBooking, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings, offers } from "../src/db/schema";
import { againFields, againUrl } from "../src/lib/booking-again";
import { forgetDancer } from "../src/lib/booking-privacy";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();

function setup(db: Db = openDb(":memory:")) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at("2026-11-07T14:00"),
    end: at("2026-11-07T15:00"),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
  };
  const result = requestBooking(db, input, { now: NOW });
  if (!result.ok) throw new Error("the request must be stored");
  return { db, offer, booking: result.booking };
}

const expected = (offerId: number) => ({
  offerId,
  name: "Ana",
  email: "ana@example.com",
  phone: "+31 6 1234 5678",
});

test("the token of a requested booking gives the offer and the fields of the dancer", () => {
  const { db, offer, booking } = setup();
  expect(againFields(db, booking.cancelToken)).toEqual(expected(offer.id));
});

test("the token of an approved booking gives the fields", () => {
  const { db, offer, booking } = setup();
  decideBooking(db, booking.id, "approved", null, NOW);
  expect(againFields(db, booking.cancelToken)).toEqual(expected(offer.id));
});

test("the token of a cancelled booking gives the fields", () => {
  const { db, offer, booking } = setup();
  cancelBooking(db, booking.id);
  expect(againFields(db, booking.cancelToken)).toEqual(expected(offer.id));
});

test("the token of an ended booking gives the fields", () => {
  const { db, offer, booking } = setup();
  decideBooking(db, booking.id, "approved", null, NOW);
  // The time of the booking lies in the past now: the fields stay until the data is forgotten (#224).
  db.update(bookings)
    .set({ start: at("2026-10-10T14:00"), end: at("2026-10-10T15:00") })
    .where(eq(bookings.id, booking.id))
    .run();
  expect(againFields(db, booking.cancelToken)).toEqual(expected(offer.id));
});

test("a wrong or an unknown token gives null", () => {
  const { db, booking } = setup();
  expect(againFields(db, "")).toBeNull();
  expect(againFields(db, "short")).toBeNull();
  expect(againFields(db, "x".repeat(43) + "!")).toBeNull();
  expect(againFields(db, "A".repeat(43))).toBeNull();
  // The id alone is never a token.
  expect(againFields(db, String(booking.id))).toBeNull();
});

test("the token of a hidden offer gives null", () => {
  const { db, booking } = setup();
  db.update(offers).set({ visible: false }).where(eq(offers.id, booking.offerId)).run();
  expect(againFields(db, booking.cancelToken)).toBeNull();
});

test("the token of a forgotten booking gives null", () => {
  const { db, booking } = setup();
  forgetDancer(db, "ana@example.com", NOW);
  expect(againFields(db, booking.cancelToken)).toBeNull();
});

test("the link has the locale of the booking and the token only", () => {
  const { booking } = setup();
  const url = new URL(againUrl("https://tumach.dance", booking));
  expect(url.origin + url.pathname).toBe("https://tumach.dance/nl/book");
  expect([...url.searchParams.keys()]).toEqual(["again"]);
  expect(url.searchParams.get("again")).toBe(booking.cancelToken);
});
