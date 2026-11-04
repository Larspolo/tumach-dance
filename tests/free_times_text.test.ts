// The text of the free times of an offer for the next 7 days (#727, epic #723).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { freeTimesText } from "../src/lib/free-times-text";
import type { HoursRule } from "../src/lib/hours";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const ORIGIN = "https://tumach.dance";
const now = at("2026-10-20T12:00"); // a Tuesday

function setup(rule: HoursRule = { weekly: { sat: { from: "17:00", to: "20:00" } } }) {
  const db = openDb(":memory:");
  saveHoursRule(db, rule);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  return { db, offer };
}

test("English: the offer, the free times per day and the link", () => {
  const { db, offer } = setup();
  const text = freeTimesText(db, offer, "en", ORIGIN, now);
  const lines = text.split("\n");
  expect(lines[0]).toContain("Private lesson, 60 min");
  expect(text).toContain("Sat, Oct 24: 17:00, 17:30, 18:00, 18:30, 19:00");
  expect(text).not.toContain("Oct 31"); // after 7 days
  expect(lines[lines.length - 1]).toContain(`${ORIGIN}/en/book?offer=${offer.id}`);
  expect(lines).toHaveLength(4);
});

test("Dutch: the day name in Dutch and the Dutch link", () => {
  const { db, offer } = setup();
  const text = freeTimesText(db, offer, "nl", ORIGIN, now);
  expect(text).toMatch(/za 24 okt\.?: 17:00, 17:30, 18:00, 18:30, 19:00/);
  expect(text).toContain("Vrije tijden");
  expect(text).toContain(`${ORIGIN}/nl/book?offer=${offer.id}`);
});

test("a held request and a block are not in the text", () => {
  const { db, offer } = setup();
  const start = at("2026-10-24T18:00");
  const held = requestBooking(
    db,
    {
      offerId: offer.id,
      start,
      end: start + 3_600_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
    },
    { now },
  );
  expect(held.ok).toBe(true);
  addBlock(db, { start: at("2026-10-24T19:00"), end: at("2026-10-24T20:00") }, now);
  expect(freeTimesText(db, offer, "en", ORIGIN, now)).toContain("Sat, Oct 24: 17:00\n");
});

test("a closed day: no free time, the text says so and has the link", () => {
  const { db, offer } = setup({ weekly: { sat: { from: "17:00", to: "20:00" } }, closed: [{ from: "2026-10-24" }] });
  const text = freeTimesText(db, offer, "en", ORIGIN, now);
  expect(text).not.toContain("Oct 24");
  expect(text).toContain("No free time in the next 7 days.");
  expect(text).toContain(`${ORIGIN}/en/book?offer=${offer.id}`);
});

test("the change to summer time on 2027-03-28 keeps the local times", () => {
  const { db, offer } = setup({ weekly: { sat: { from: "10:00", to: "13:00" }, sun: { from: "10:00", to: "13:00" } } });
  const text = freeTimesText(db, offer, "en", ORIGIN, at("2027-03-26T12:00"));
  expect(text).toContain("Sat, Mar 27: 10:00, 10:30, 11:00, 11:30, 12:00");
  expect(text).toContain("Sun, Mar 28: 10:00, 10:30, 11:00, 11:30, 12:00");
});
