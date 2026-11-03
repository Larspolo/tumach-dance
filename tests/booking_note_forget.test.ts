// The note of a dancer is removed with the name, email and phone: by the 12-month rule and by the removal of a dancer (#389).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { forgetDancer, forgetOldBookings } from "../src/lib/booking-privacy";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

function setup() {
  const db = openDb(":memory:");
  const offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
  const add = (email: string, end: number, note: string | null) =>
    db
      .insert(bookings)
      .values({
        offerId,
        priceCents: 6000,
        start: end - HOUR,
        end,
        status: "approved",
        name: "Ana",
        email,
        phone: "+31 6 1234 5678",
        note,
        locale: "en",
        createdAt: 0,
      })
      .returning({ id: bookings.id })
      .get().id;
  return { db, add };
}

const noteOf = (db: ReturnType<typeof openDb>, id: number) =>
  db.select().from(bookings).where(eq(bookings.id, id)).get()?.note;

test("forgetOldBookings clears the note of each old booking and keeps the note of a recent one", () => {
  const { db, add } = setup();
  const now = at("2026-11-02T12:00");
  const old = add("ana@example.com", at("2025-10-01T10:00"), "my knee");
  const recent = add("ana@example.com", at("2026-10-01T10:00"), "my knee");

  expect(forgetOldBookings(db, now)).toEqual([old]);
  expect(noteOf(db, old)).toBeNull();
  expect(noteOf(db, recent)).toBe("my knee");
});

test("forgetDancer clears the note of each booking of that dancer and keeps the note of another dancer", () => {
  const { db, add } = setup();
  const now = at("2026-11-02T12:00");
  const ana = add("ana@example.com", at("2026-10-01T10:00"), "my knee");
  const anaComing = add("ANA@example.com", at("2026-12-01T10:00"), "bring a mat");
  const ben = add("ben@example.com", at("2026-12-01T10:00"), "first lesson");

  expect(forgetDancer(db, "ana@example.com", now).sort()).toEqual([ana, anaComing].sort());
  expect(noteOf(db, ana)).toBeNull();
  expect(noteOf(db, anaComing)).toBeNull();
  expect(noteOf(db, ben)).toBe("first lesson");
});
