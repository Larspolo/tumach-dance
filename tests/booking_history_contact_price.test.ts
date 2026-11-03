// The history of a booking (#830): a change of the contact data or the price is an event, a failed change is none.
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { changeContact, changePrice } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookingEvents, bookings } from "../src/db/schema";

const START = Date.UTC(2026, 10, 7, 13);
const NOW = Date.UTC(2026, 9, 20, 12);
const NEW = { name: "Ana", email: "ana@example.com", phone: "06 8765 4321" };

function setup(status: "requested" | "approved" | "cancelled") {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const booking = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: 6000,
      start: START,
      end: START + 3_600_000,
      status,
      name: "Anna",
      email: "ana@exmaple.com",
      phone: "+31 6 1234 5678",
      locale: "en",
      createdAt: START - 86_400_000,
    })
    .returning()
    .get();
  const events = () =>
    db
      .select({ kind: bookingEvents.kind, by: bookingEvents.by, at: bookingEvents.at })
      .from(bookingEvents)
      .where(eq(bookingEvents.bookingId, booking.id))
      .all();
  return { db, id: booking.id, events };
}

test("changeContact writes one contact event by nina", () => {
  const { db, id, events } = setup("approved");
  expect(changeContact(db, id, NEW, NOW)).toMatchObject({ ok: true });
  expect(events()).toEqual([{ kind: "contact", by: "nina", at: NOW }]);
});

test("changePrice writes one price event by nina", () => {
  const { db, id, events } = setup("requested");
  expect(changePrice(db, id, 4500, NOW)).toMatchObject({ priceCents: 4500 });
  expect(events()).toEqual([{ kind: "price", by: "nina", at: NOW }]);
});

test("a wrong field in changeContact writes no event", () => {
  const { db, id, events } = setup("approved");
  expect(changeContact(db, id, { ...NEW, name: "" }, NOW)).toEqual({ ok: false, reason: "invalid", field: "name" });
  expect(events()).toEqual([]);
});

test("a cancelled booking gets no contact or price event", () => {
  const { db, id, events } = setup("cancelled");
  expect(changeContact(db, id, NEW, NOW)).toEqual({ ok: false, reason: "not-found" });
  expect(changePrice(db, id, 4500, NOW)).toBeUndefined();
  expect(events()).toEqual([]);
});

test("a negative price writes no event", () => {
  const { db, id, events } = setup("approved");
  expect(changePrice(db, id, -1, NOW)).toBeUndefined();
  expect(events()).toEqual([]);
});
