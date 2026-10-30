// The view of a booking whose personal data was removed (#225): "Name removed" instead of an empty name.

import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, describe, expect, it } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import sl from "../messages/sl.json";
import { type Db, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { shownName } from "../src/lib/booking-name";
import { forgetOldBookings } from "../src/lib/booking-privacy";
import { calendarFeed } from "../src/lib/calendar-feed";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-22T12:00");
const REMOVED = "Name removed";

let db: Db;
beforeEach(() => {
  db = openDb(":memory:");
});

function approvedBooking(start: string, name: string): number {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at(start),
    end: at(start) + 60 * 60_000,
    name,
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "en",
  };
  const r = requestBooking(db, input, { now: NOW });
  if (!r.ok) throw new Error(`no booking: ${r.reason}`);
  decideBooking(db, r.booking.id, "approved");
  return r.booking.id;
}

describe("shownName", () => {
  it("gives the name of a booking that is not removed", () => {
    expect(shownName({ name: "Ana", forgottenAt: null }, REMOVED)).toBe("Ana");
  });

  it("gives the removed text for a removed booking, never an empty name", () => {
    expect(shownName({ name: "", forgottenAt: at("2026-10-01T12:00") }, REMOVED)).toBe(REMOVED);
  });
});

describe("calendar feed of a removed booking", () => {
  it("has the removed text in the summary and no phone or email", async () => {
    approvedBooking("2026-10-25T19:00", "Ana");
    // A year after the booking ended, the site removes its personal data (#224).
    expect(forgetOldBookings(db, at("2027-11-01T12:00"))).toHaveLength(1);
    const text = (await calendarFeed(db, "en", NOW)).replace(/\r\n[ \t]/g, "");
    expect(text).toContain(`SUMMARY:Private lesson\\, 60 min: ${REMOVED}`);
    expect(text).not.toContain("Ana");
    expect(text).not.toContain("+31");
    expect(text).not.toContain("ana@example.com");
    expect(text).not.toContain("DESCRIPTION:");
  });

  it("keeps the name and phone of a booking that is not removed", async () => {
    approvedBooking("2026-10-25T19:00", "Ana");
    const text = (await calendarFeed(db, "en", NOW)).replace(/\r\n[ \t]/g, "");
    expect(text).toContain("SUMMARY:Private lesson\\, 60 min: Ana");
    expect(text).toContain("+31 6 1234 5678");
    expect(text).not.toContain(REMOVED);
  });

  it("uses the removed text of the language of the feed", async () => {
    approvedBooking("2026-10-25T19:00", "Ana");
    forgetOldBookings(db, at("2027-11-01T12:00"));
    const text = (await calendarFeed(db, "nl", NOW)).replace(/\r\n[ \t]/g, "");
    expect(text).toContain(`: ${nl.StudioWeek.removed}`);
    expect(text).not.toContain(REMOVED);
  });

  it("does not change the row of a removed booking beyond its personal data", () => {
    const id = approvedBooking("2026-10-25T19:00", "Ana");
    forgetOldBookings(db, at("2027-11-01T12:00"));
    const row = db.select().from(bookings).where(eq(bookings.id, id)).get();
    expect(row?.name).toBe("");
    expect(row?.status).toBe("approved");
    expect(row?.forgottenAt).not.toBeNull();
  });
});

describe("the removed text in the messages", () => {
  it.each([
    ["en", en],
    ["nl", nl],
    ["sl", sl],
  ])("has StudioWeek.removed in %s", (_locale, messages) => {
    expect(messages.StudioWeek.removed.trim().length).toBeGreaterThan(0);
  });

  it("is 'Name removed' in English", () => {
    expect(en.StudioWeek.removed).toBe(REMOVED);
  });
});
