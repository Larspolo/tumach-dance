// The moves and the payment marks of a booking in its history (#816, epic #813).
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import en from "../messages/en.json";
import { openDb } from "../src/db";
import {
  decideBooking,
  markPaid,
  moveBooking,
  moveBookingToRequest,
  requestBooking,
  unmarkPaid,
} from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookingHistory, eventMessageKey, eventWhen } from "../src/lib/booking-history";

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");
const HOUR = 60 * 60_000;

function setup(start: string, name = "Ana") {
  const db = openDb(":memory:");
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const book = (when: string, who: string) => {
    const result = requestBooking(
      db,
      {
        offerId: offer.id,
        start: at(when),
        end: at(when) + HOUR,
        name: who,
        email: `${who.toLowerCase()}@example.com`,
        phone: "+31 6 1234 5678",
        locale: "nl",
      },
      { now: NOW },
    );
    if (!result.ok) throw new Error(JSON.stringify(result));
    decideBooking(db, result.booking.id, "approved", null, NOW);
    return result.booking.id;
  };
  return { db, id: book(start, name), book };
}

test("a move by Nina gives one moved event with the old time, by nina", () => {
  const { db, id } = setup("2026-11-07T14:00");
  expect(moveBooking(db, id, at("2026-11-08T16:00"), { now: NOW + 1000 })).toMatchObject({ ok: true });
  const moves = bookingHistory(db, id).filter((e) => e.kind === "moved");
  expect(moves).toEqual([{ at: NOW + 1000, kind: "moved", by: "nina", fromStart: at("2026-11-07T14:00") }]);
});

test("a move by the dancer gives one moved event with the old time, by dancer", () => {
  const { db, id } = setup("2026-11-07T14:00");
  expect(moveBookingToRequest(db, id, at("2026-11-08T16:00"), { now: NOW + 1000 })).toMatchObject({ ok: true });
  const moves = bookingHistory(db, id).filter((e) => e.kind === "moved");
  expect(moves).toEqual([{ at: NOW + 1000, kind: "moved", by: "dancer", fromStart: at("2026-11-07T14:00") }]);
});

test("a move to a time that is not free writes no event", () => {
  const { db, id, book } = setup("2026-11-07T14:00");
  book("2026-11-08T16:00", "Bo");
  expect(moveBooking(db, id, at("2026-11-08T16:00"), { now: NOW + 1000 })).toMatchObject({ ok: false });
  expect(bookingHistory(db, id).some((e) => e.kind === "moved")).toBe(false);
});

test("a mark and an unmark of the payment each give one event", () => {
  const { db, id } = setup("2026-11-07T14:00");
  expect(markPaid(db, id, NOW + 1000)).toMatchObject({ ok: true });
  markPaid(db, id, NOW + 2000); // a second mark changes nothing
  expect(unmarkPaid(db, id, NOW + 3000)).toMatchObject({ ok: true });
  unmarkPaid(db, id, NOW + 4000);
  expect(bookingHistory(db, id).map((e) => [e.kind, e.by])).toEqual([
    ["requested", "dancer"],
    ["approved", "nina"],
    ["paid", "nina"],
    ["unpaid", "nina"],
  ]);
});

test("the line of a move shows the old time in Amsterdam time, over the change to winter time", () => {
  // Oct 24 is summer time (UTC+2); the move on Oct 31 is winter time (UTC+1).
  const { db, id } = setup("2026-10-24T14:00");
  expect(moveBookingToRequest(db, id, at("2026-10-31T16:00"), { now: NOW + 1000 })).toMatchObject({ ok: true });
  const move = bookingHistory(db, id).find((e) => e.kind === "moved");
  if (!move || move.fromStart === null) throw new Error("no move");
  const key = eventMessageKey(move) as keyof typeof en.StudioWeek;
  expect(key).toBe("event_moved_dancer");
  const line = en.StudioWeek[key].replace("{from}", eventWhen(move.fromStart, "en"));
  expect(line).toBe("Moved by the dancer from Oct 24, 2026, 14:00");
});
