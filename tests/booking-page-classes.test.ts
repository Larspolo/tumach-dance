// The free times of the booking page and the requests keep out of the class times (#99).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addClass, addClassTime, hideClass } from "../src/db/classes";
import { addOffer } from "../src/db/offers";
import { bookingDays } from "../src/lib/booking-page";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const hhmm = (ms: number) => DateTime.fromMillis(ms, { zone }).toFormat("HH:mm");
const CLASS_START = at("2026-10-20T19:00");
const CLASS_END = at("2026-10-20T20:30");

// Tuesday 20 Oct 2026 (winter time from 25 Oct on, not in this test): a class 19:00 to 20:30, open 10:00 to 22:00.
function setup({ classVisible = true } = {}) {
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { tue: { from: "10:00", to: "22:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const cls = addClass(db, {
    name: { en: "Salsa" },
    text: { en: "Social dance" },
    forWhom: { en: "Everyone" },
    position: 0,
  });
  addClassTime(db, { classId: cls.id, weekday: "tue", from: "19:00", to: "20:30" });
  if (!classVisible) hideClass(db, cls.id);
  return { db, offer };
}

const tuesday = (db: ReturnType<typeof setup>["db"], offer: ReturnType<typeof setup>["offer"]) =>
  bookingDays(db, offer, at("2026-10-20T12:00")).find((d) => d.date === "2026-10-20")?.slots ?? [];

test("no slot of the page overlaps a class time", () => {
  const { db, offer } = setup();
  for (const day of bookingDays(db, offer, at("2026-10-20T12:00"))) {
    for (const slot of day.slots) {
      expect(slot.start < CLASS_END && CLASS_START < slot.end).toBe(false);
    }
  }
});

test("the slots before and after the class stay free; the ones in it are gone", () => {
  const { db, offer } = setup();
  const starts = tuesday(db, offer).map((s) => hhmm(s.start));
  // A 60 minute slot ends at 19:00 at the latest before the class, and starts at 20:30 after it.
  expect(starts).toContain("18:00");
  expect(starts).toContain("20:30");
  expect(starts).toContain("21:00");
  for (const gone of ["18:30", "19:00", "19:30", "20:00"]) expect(starts).not.toContain(gone);
});

test("a hidden class blocks nothing", () => {
  const { db, offer } = setup({ classVisible: false });
  const starts = tuesday(db, offer).map((s) => hhmm(s.start));
  expect(starts).toContain("19:00");
  expect(starts).toContain("19:30");
});

test("a request at the time of a class is taken; the time before it is not", () => {
  const { db, offer } = setup();
  const request = (start: string, end: string) =>
    requestBooking(
      db,
      {
        offerId: offer.id,
        start: at(start),
        end: at(end),
        name: "Ana",
        email: "ana@example.com",
        phone: "+31 6 1234 5678",
        locale: "en",
      },
      { now: at("2026-10-20T12:00") },
    );
  expect(request("2026-10-20T19:00", "2026-10-20T20:00")).toEqual({ ok: false, reason: "taken" });
  expect(request("2026-10-20T18:00", "2026-10-20T19:00").ok).toBe(true);
});
