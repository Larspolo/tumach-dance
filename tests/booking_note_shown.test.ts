// The note of a dancer in Nina's app (#388): shown, cut short on the week page, none when the data is removed.
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { shownNote } from "../src/lib/booking-name";
import { forgetDancer } from "../src/lib/booking-privacy";

describe("shownNote", () => {
  it("gives the note with its line breaks", () => {
    expect(shownNote({ note: "Hi Nina\nsee you", forgottenAt: null })).toBe("Hi Nina\nsee you");
  });

  it("gives no note when there is none", () => {
    expect(shownNote({ note: null, forgottenAt: null })).toBeNull();
  });

  it("gives no note for a booking whose data was removed", () => {
    expect(shownNote({ note: "secret", forgottenAt: 1 })).toBeNull();
  });

  it("cuts a long note at max characters with …", () => {
    expect(shownNote({ note: "a".repeat(100), forgottenAt: null }, 80)).toBe(`${"a".repeat(80)}…`);
    expect(shownNote({ note: "short", forgottenAt: null }, 80)).toBe("short");
  });
});

it("forgetDancer removes the note too", () => {
  const db = openDb(":memory:");
  const offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
  const { id } = db
    .insert(bookings)
    .values({
      offerId,
      start: 0,
      end: 3_600_000,
      status: "requested",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      note: "my knee",
      locale: "en",
      createdAt: 0,
    })
    .returning()
    .get();
  forgetDancer(db, "ana@example.com");
  expect(db.select().from(bookings).where(eq(bookings.id, id)).get()?.note).toBeNull();
});
