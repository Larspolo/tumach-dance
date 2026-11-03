// The history of a booking (#814): the request, the decision and its undo, in order, with their actor.
import { rmSync } from "node:fs";
import Database from "better-sqlite3";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { decideBooking, requestBooking, undoDecision } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { bookingHistory, eventWhen, recordBookingEvent } from "../src/lib/booking-history";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");

test("a request, an approval and an undo give 3 events in order with their actor", () => {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T15:00"),
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(JSON.stringify(result));
  const id = result.booking.id;
  expect(decideBooking(db, id, "approved", null, NOW + 1000)).toMatchObject({ ok: true });
  expect(undoDecision(db, id, NOW + 2000)).toMatchObject({ ok: true });
  expect(bookingHistory(db, id)).toEqual([
    { at: NOW, kind: "requested", by: "dancer", fromStart: null },
    { at: NOW + 1000, kind: "approved", by: "nina", fromStart: null },
    { at: NOW + 2000, kind: "undone", by: "nina", fromStart: null },
  ]);
  // A second decision changes nothing, so it records nothing.
  decideBooking(db, id, "declined", null, NOW + 3000);
  decideBooking(db, id, "declined", null, NOW + 4000);
  expect(bookingHistory(db, id).map((e) => e.kind)).toEqual(["requested", "approved", "undone", "declined"]);
});

test("a booking with no events gives the events of its row", () => {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const row = db
    .insert(bookings)
    .values({
      offerId: offer.id,
      start: at("2026-11-07T14:00"),
      end: at("2026-11-07T15:00"),
      priceCents: 6000,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "",
      locale: "en",
      createdAt: NOW,
      approvedAt: NOW + 10,
      paidAt: NOW + 20,
    })
    .returning()
    .get();
  expect(bookingHistory(db, row.id)).toEqual([
    { at: NOW, kind: "requested", by: "dancer", fromStart: null },
    { at: NOW + 10, kind: "approved", by: "nina", fromStart: null },
    { at: NOW + 20, kind: "paid", by: "site", fromStart: null },
  ]);
  recordBookingEvent(db, row.id, "undone", "nina", { at: NOW + 30 });
  expect(bookingHistory(db, row.id).map((e) => e.kind)).toEqual(["undone"]);
  expect(bookingHistory(db, 999)).toEqual([]);
});

test("the time of an event shows in Amsterdam time, in summer and in winter time", () => {
  expect(eventWhen(Date.UTC(2026, 6, 1, 12, 5), "en")).toBe("Jul 1, 2026, 14:05");
  expect(eventWhen(Date.UTC(2026, 11, 1, 12, 5), "en")).toBe("Dec 1, 2026, 13:05");
  expect(eventWhen(Date.UTC(2026, 11, 1, 12, 5), "nl")).toContain("13:05");
});

test("the migration applies on an empty database and on a database with bookings", () => {
  const file = `${process.env.TMPDIR ?? "/tmp"}/history-${process.pid}.db`;
  const db = openDb(file);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  db.insert(bookings)
    .values({
      offerId: offer.id,
      priceCents: 6000,
      start: NOW,
      end: NOW + 1,
      name: "A",
      email: "",
      phone: "",
      locale: "en",
      createdAt: NOW,
    })
    .run();
  // Back to the database before #814, with a booking: the next open applies the migration again.
  const raw = new Database(file);
  raw.exec("DROP TABLE booking_events");
  raw.exec("DELETE FROM __drizzle_migrations WHERE created_at = (SELECT max(created_at) FROM __drizzle_migrations)");
  raw.close();
  const again = openDb(file);
  expect(bookingHistory(again, 1).map((e) => e.kind)).toEqual(["requested"]);
  recordBookingEvent(again, 1, "approved", "nina", { at: NOW + 1 });
  expect(bookingHistory(again, 1).map((e) => e.kind)).toEqual(["approved"]);
  rmSync(file, { force: true });
});
