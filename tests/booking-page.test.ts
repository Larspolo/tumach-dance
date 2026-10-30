// The free times of the booking page (#36): only open hours, no busy time, nothing before now plus the notice.
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer, hideOffer, listOffers } from "../src/db/offers";
import { BOOKING_NOTICE_HOURS, notBefore } from "../src/lib/booking-notice";
import { BOOKING_DAYS, bookingDays } from "../src/lib/booking-page";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const local = (ms: number) => DateTime.fromMillis(ms, { zone }).toFormat("yyyy-MM-dd HH:mm");

function setup() {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sat: { from: "10:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  return { db, offer };
}

test("the page shows 4 weeks; a closed day has no time", () => {
  const { db, offer } = setup();
  const days = bookingDays(db, offer, at("2026-10-20T12:00"));
  expect(days).toHaveLength(BOOKING_DAYS);
  expect(days[0].date).toBe("2026-10-20");
  expect(days.find((d) => d.date === "2026-10-21")?.slots).toEqual([]);
});

test("only times in the open hours, with no busy time", () => {
  const { db, offer } = setup();
  const now = at("2026-10-20T12:00");
  const booked = requestBooking(
    db,
    {
      offerId: offer.id,
      start: at("2026-10-24T11:00"),
      end: at("2026-10-24T12:00"),
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
    },
    { now },
  );
  expect(booked.ok).toBe(true);
  const saturday = bookingDays(db, offer, now).find((d) => d.date === "2026-10-24");
  expect(saturday?.slots.map((s) => local(s.start))).toEqual(["2026-10-24 10:00", "2026-10-24 12:00"]);
});

test("no time sooner than the notice, also on the day of the end of summer time", () => {
  const { db, offer } = setup();
  const now = at("2026-10-24T10:40");
  expect(notBefore(now)).toBe(now + BOOKING_NOTICE_HOURS * 3_600_000);
  const days = bookingDays(db, offer, now);
  const all = days.flatMap((d) => d.slots);
  expect(all.every((s) => s.start >= notBefore(now))).toBe(true);
  expect(days[0].slots.map((s) => local(s.start))).toEqual([
    "2026-10-24 11:00",
    "2026-10-24 11:30",
    "2026-10-24 12:00",
  ]);
  // The next Saturday is in winter time: still 10:00 local.
  expect(local(days[7].slots[0].start)).toBe("2026-10-31 10:00");
});

test("a hidden offer is not in the offers of the page", () => {
  const { db, offer } = setup();
  const hidden = addOffer(db, { kind: "rental", minutes: 120, priceCents: 8000, position: 1 });
  hideOffer(db, hidden.id);
  expect(listOffers(db, { visibleOnly: true }).map((o) => o.id)).toEqual([offer.id]);
});
