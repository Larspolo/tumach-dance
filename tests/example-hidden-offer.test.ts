// #296: a preview with only a hidden offer showed "nothing to book"; the example seeds add a visible offer.
import { DateTime } from "luxon";
import { expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { addOffer, hideOffer, listOffers } from "../src/db/offers";
import { bookingDays } from "../src/lib/booking-page";
import { TIME_ZONE } from "../src/lib/hours";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn() }));
vi.mock("../src/lib/push", () => ({ sendPush: vi.fn() }));
const { seedExample } = await import("../src/lib/examples");

const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: TIME_ZONE }).toMillis();

function hiddenOnly() {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 5000, visible: true, position: 1 });
  hideOffer(db, offer.id);
  expect(listOffers(db, { visibleOnly: true })).toEqual([]);
  return db;
}

test("the offers seed adds a visible offer with free times when the only offer is hidden", () => {
  const db = hiddenOnly();
  expect(seedExample(db, "offers", NOW)).toBe(2);
  const offer = listOffers(db, { visibleOnly: true })[0];
  expect(bookingDays(db, offer, NOW).some((d) => d.slots.length > 0)).toBe(true);
});

test("the bookings seed books a visible offer when the only offer is hidden", () => {
  const db = hiddenOnly();
  expect(seedExample(db, "bookings", NOW)).toBe(4);
});
