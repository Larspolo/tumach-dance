// Nina corrects the name, email or phone of a booking (#759).
import { eq } from "drizzle-orm";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { changeContact } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const START = Date.UTC(2026, 10, 7, 13);

function setup(status: "requested" | "approved" | "cancelled", forgottenAt: number | null = null) {
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
      forgottenAt,
    })
    .returning()
    .get();
  const row = () => db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  return { db, id: booking.id, row };
}

const NEW = { name: " Ana ", email: "ana@example.com", phone: "06 8765 4321" };

for (const status of ["requested", "approved"] as const) {
  test(`changeContact changes the name, email and phone of a ${status} booking`, () => {
    const { db, id, row } = setup(status);
    const result = changeContact(db, id, NEW);
    expect(result).toMatchObject({ ok: true, emailChanged: true, booking: { name: "Ana", email: "ana@example.com" } });
    expect(row()).toMatchObject({ name: "Ana", email: "ana@example.com", phone: "06 8765 4321", status });
    expect(changeContact(db, id, { ...NEW, name: "Ana B" })).toMatchObject({ ok: true, emailChanged: false });
  });
}

test("changeContact accepts an empty email and phone, as a lesson that Nina adds", () => {
  const { db, id, row } = setup("approved");
  expect(changeContact(db, id, { name: "Ana", email: "", phone: "" })).toMatchObject({ ok: true });
  expect(row()).toMatchObject({ email: "", phone: "" });
});

test("changeContact refuses a wrong field and changes nothing", () => {
  const { db, id, row } = setup("approved");
  const before = row();
  expect(changeContact(db, id, { ...NEW, email: "ana@" })).toEqual({ ok: false, reason: "invalid", field: "email" });
  expect(changeContact(db, id, { ...NEW, phone: "abc" })).toEqual({ ok: false, reason: "invalid", field: "phone" });
  expect(changeContact(db, id, { ...NEW, name: "  " })).toEqual({ ok: false, reason: "invalid", field: "name" });
  expect(row()).toEqual(before);
});

test("changeContact refuses a cancelled booking, a booking with its data removed and an unknown id", () => {
  const cancelled = setup("cancelled");
  expect(changeContact(cancelled.db, cancelled.id, NEW)).toEqual({ ok: false, reason: "not-found" });
  expect(cancelled.row()?.name).toBe("Anna");
  const forgotten = setup("approved", START);
  expect(changeContact(forgotten.db, forgotten.id, NEW)).toEqual({ ok: false, reason: "not-found" });
  expect(forgotten.row()?.email).toBe("ana@exmaple.com");
  expect(changeContact(forgotten.db, 999, NEW)).toEqual({ ok: false, reason: "not-found" });
});
