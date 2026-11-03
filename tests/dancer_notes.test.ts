// Nina's private note about a dancer (#695, epic #691): one note per dancer (the email, else the phone digits), the
// limit of 500 characters, and its removal with the forget of the dancer and with the old data.
import { DateTime } from "luxon";
import { beforeEach, expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { DANCER_NOTE_MAX, dancerKey, getDancerNote, pruneDancerNotes, setDancerNote } from "../src/db/dancer-notes";
import { addOffer } from "../src/db/offers";
import { bookings, dancerNotes } from "../src/db/schema";
import { forgetDancerOfBooking } from "../src/lib/booking-forget";
import { forgetDancer, forgetOldBookings } from "../src/lib/booking-privacy";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 3_600_000;
const NOW = at("2026-11-03T12:00");

let db: Db;
let offerId: number;

beforeEach(() => {
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

/** An approved booking that starts at the local time `start`, of the dancer with this email and phone. */
function book(start: string, email: string, phone: string) {
  const begin = at(start);
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start: begin,
      end: begin + HOUR,
      status: "approved",
      name: "Ana",
      email,
      phone,
      locale: "nl",
      createdAt: begin - 7 * 24 * HOUR,
    })
    .returning()
    .get();
}

test("the note is trimmed, an empty text removes it, and a booking with no email and no phone has none", () => {
  const ana = book("2026-11-07T14:00", "ana@example.com", "+31 6 1234 5678");
  expect(getDancerNote(db, ana)).toBeNull();
  expect(setDancerNote(db, ana, "  Level 2, works on spins.\n", NOW)).toEqual({
    ok: true,
    note: "Level 2, works on spins.",
  });
  expect(getDancerNote(db, ana)).toBe("Level 2, works on spins.");
  expect(setDancerNote(db, ana, "Level 3.", NOW + 1)).toEqual({ ok: true, note: "Level 3." });
  expect(db.select().from(dancerNotes).all()).toEqual([
    { key: "ana@example.com", text: "Level 3.", updatedAt: NOW + 1 },
  ]);
  expect(setDancerNote(db, ana, "   ", NOW)).toEqual({ ok: true, note: null });
  expect(getDancerNote(db, ana)).toBeNull();
  expect(db.select().from(dancerNotes).all()).toHaveLength(0);

  const nobody = book("2026-11-08T14:00", " ", "-");
  expect(dancerKey(nobody)).toBeNull();
  expect(setDancerNote(db, nobody, "Hi", NOW)).toEqual({ ok: false, reason: "no-dancer" });
  expect(getDancerNote(db, nobody)).toBeNull();
});

test("a text of 500 characters is stored; one more character stores nothing and keeps the old note", () => {
  const ana = book("2026-11-07T14:00", "ana@example.com", "");
  expect(setDancerNote(db, ana, "a".repeat(DANCER_NOTE_MAX), NOW)).toEqual({ ok: true, note: "a".repeat(500) });
  expect(setDancerNote(db, ana, "b".repeat(DANCER_NOTE_MAX + 1), NOW)).toEqual({ ok: false, reason: "too-long" });
  expect(getDancerNote(db, ana)).toBe("a".repeat(500));
});

test("the same email in another case, or with no email the same phone digits, gives the same note", () => {
  const first = book("2026-11-07T14:00", "Ana@Example.com ", "+31 6 1234 5678");
  const later = book("2026-11-14T14:00", "ana@example.COM", "06 99 99 99 99");
  setDancerNote(db, first, "Likes slow songs.", NOW);
  expect(getDancerNote(db, later)).toBe("Likes slow songs.");

  const byPhone = book("2026-11-08T14:00", "", "+31 6 8765 4321");
  const samePhone = book("2026-11-15T14:00", "", "31-6-8765-4321");
  setDancerNote(db, byPhone, "Came by WhatsApp.", NOW);
  expect(getDancerNote(db, samePhone)).toBe("Came by WhatsApp.");

  // Another dancer gets none, also with the phone of a dancer of a note: with an email, the email names the dancer,
  // as `dancerWhere()` of the page of a dancer (#621).
  expect(getDancerNote(db, book("2026-11-21T14:00", "bo@example.com", "+31 6 1234 5678"))).toBeNull();
  expect(getDancerNote(db, book("2026-11-22T14:00", "eva@example.com", "+31 6 8765 4321"))).toBeNull();
  expect(getDancerNote(db, book("2026-11-28T14:00", "", "+31 6 1111 2222"))).toBeNull();
});

test("the forget of a dancer from a booking removes the note of that dancer and keeps the notes of others", async () => {
  const ana = book("2026-10-03T14:00", "ana@example.com", "+31 6 1234 5678");
  const bo = book("2026-10-04T14:00", "", "+31 6 8765 4321");
  const eva = book("2026-10-10T14:00", "eva@example.com", "");
  setDancerNote(db, ana, "Ana's note", NOW);
  setDancerNote(db, bo, "Bo's note", NOW);
  setDancerNote(db, eva, "Eva's note", NOW);

  expect(await forgetDancerOfBooking(db, ana.id, NOW)).toEqual([ana.id]);
  expect(await forgetDancerOfBooking(db, bo.id, NOW)).toEqual([bo.id]);
  expect(getDancerNote(db, ana)).toBeNull();
  expect(getDancerNote(db, bo)).toBeNull();
  expect(db.select({ key: dancerNotes.key }).from(dancerNotes).all()).toEqual([{ key: "eva@example.com" }]);

  // `forgetDancer()` by the email (any case) too.
  expect(forgetDancer(db, "EVA@example.com", NOW)).toEqual([eva.id]);
  expect(db.select().from(dancerNotes).all()).toHaveLength(0);
});

test("the removal of the old data removes a note only when no booking of the dancer keeps its data", () => {
  // Ended more than 12 months before NOW: their data goes.
  const ana = book("2025-09-06T14:00", "ana@example.com", "");
  const bo = book("2025-09-07T14:00", "", "+31 6 8765 4321");
  // Bo has a newer booking (same phone digits), so the note of Bo stays.
  book("2026-10-04T14:00", "", "+31 6-8765-4321");
  setDancerNote(db, ana, "Ana's note", NOW);
  setDancerNote(db, bo, "Bo's note", NOW);

  expect(forgetOldBookings(db, NOW).sort()).toEqual([ana.id, bo.id].sort());
  expect(db.select({ key: dancerNotes.key, text: dancerNotes.text }).from(dancerNotes).all()).toEqual([
    { key: "phone:31687654321", text: "Bo's note" },
  ]);
  // A second sweep changes nothing.
  expect(pruneDancerNotes(db)).toBe(0);
  expect(forgetOldBookings(db, NOW)).toEqual([]);
});
