// A block of Nina keeps its time out of the booking page and of the requests (#324, epic #322).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, openDb } from "../src/db";
import { addBlock, removeBlock } from "../src/db/blocks";
import { requestBooking } from "../src/db/bookings";
import { addOffer, type Offer } from "../src/db/offers";
import { bookingDays } from "../src/lib/booking-page";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();

const MINUTES = 60;
const now = at("2026-10-20T12:00");
const DAY = "2026-10-24"; // a Saturday, with open hours 10:00 to 20:00

function setup() {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sat: { from: "10:00", to: "20:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: MINUTES, priceCents: 6000, position: 0 });
  return { db, offer };
}

const form = (offerId: number, start: number) => ({
  offerId,
  start,
  end: start + MINUTES * 60_000,
  name: "Ana",
  email: "ana@example.com",
  phone: "+31 6 1234 5678",
  locale: "en" as const,
});

function slotStarts(db: Db, offer: Offer): number[] {
  return (
    bookingDays(db, offer, now)
      .find((d) => d.date === DAY)
      ?.slots.map((s) => s.start) ?? []
  );
}

test("a block of 18:00 to 19:00 has no slot that overlaps it", () => {
  const { db, offer } = setup();
  const before = slotStarts(db, offer);
  expect(before).toContain(at("2026-10-24T18:00"));

  addBlock(db, { start: at("2026-10-24T18:00"), end: at("2026-10-24T19:00") }, now);
  const after = slotStarts(db, offer);
  const blockStart = at("2026-10-24T18:00");
  const blockEnd = at("2026-10-24T19:00");
  const overlapping = after.filter((s) => s < blockEnd && s + MINUTES * 60_000 > blockStart);
  expect(overlapping).toEqual([]);
  // The slots before and after the block stay.
  expect(after).toContain(at("2026-10-24T10:00"));
  expect(after).toContain(at("2026-10-24T19:00"));
});

test("a request for 18:00 is taken while the block lasts; after removeBlock it is ok", () => {
  const { db, offer } = setup();
  const block = addBlock(db, { start: at("2026-10-24T18:00"), end: at("2026-10-24T19:00") }, now);

  const taken = requestBooking(db, form(offer.id, at("2026-10-24T18:00")), { now });
  expect(taken).toEqual({ ok: false, reason: "taken" });

  expect(removeBlock(db, block.id)?.id).toBe(block.id);
  expect(slotStarts(db, offer)).toContain(at("2026-10-24T18:00"));

  const ok = requestBooking(db, form(offer.id, at("2026-10-24T18:00")), { now });
  expect(ok.ok).toBe(true);
});
