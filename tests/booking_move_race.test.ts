// A move and a request, or two moves, for the same time at the same moment (#434, epic #406): one gets the time, the
// other gets "taken", and the database has no overlap. Two connections to one file, as two requests of the server.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DateTime } from "luxon";
import { afterEach, expect, test } from "vitest";
import { openDb } from "../src/db";
import { type BookingInput, decideBooking, moveBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";

const zone = "Europe/Amsterdam";
const at = (local: string) => DateTime.fromISO(local, { zone }).toMillis();
const NOW = at("2026-10-20T12:00");
const HOUR = 60 * 60_000;

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function setup() {
  const dir = mkdtempSync(join(tmpdir(), "tumach-move-race-"));
  dirs.push(dir);
  const path = join(dir, "test.db");
  const db = openDb(path);
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input = (start: string, name: string): BookingInput => ({
    offerId: offer.id,
    start: at(start),
    end: at(start) + HOUR,
    name,
    email: `${name.toLowerCase()}@example.com`,
    phone: "+31 6 1234 5678",
    locale: "nl",
  });
  const book = (start: string, name: string) => {
    const result = requestBooking(db, input(start, name), { now: NOW });
    if (!result.ok) throw new Error(`the request at ${start} must be stored`);
    decideBooking(db, result.booking.id, "approved", null, NOW);
    return result.booking;
  };
  return { path, input, book };
}

function noOverlap(path: string) {
  const rows = openDb(path)
    .select()
    .from(bookings)
    .all()
    .filter((b) => b.status === "requested" || b.status === "approved")
    .sort((a, b) => a.start - b.start);
  for (let i = 1; i < rows.length; i++) expect(rows[i].start).toBeGreaterThanOrEqual(rows[i - 1].end);
}

test("a move and a request for the same time at the same moment: one gets it, the other is taken", async () => {
  const { path, input, book } = setup();
  const booking = book("2026-11-07T14:00", "Ana");
  const target = "2026-11-08T16:00";
  const results = await Promise.all([
    (async () => moveBooking(openDb(path), booking.id, at(target), { now: NOW }))(),
    (async () => requestBooking(openDb(path), input(target, "Bo"), { now: NOW }))(),
  ]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "taken" }]);
  const atTarget = openDb(path)
    .select()
    .from(bookings)
    .all()
    .filter((b) => b.start === at(target));
  expect(atTarget).toHaveLength(1);
  noOverlap(path);
});

test("two moves to the same time at the same moment: one gets it, the other is taken", async () => {
  const { path, book } = setup();
  const a = book("2026-11-07T14:00", "Ana");
  const b = book("2026-11-07T16:00", "Bo");
  const target = at("2026-11-08T16:30");
  const results = await Promise.all([
    (async () => moveBooking(openDb(path), a.id, target, { now: NOW }))(),
    (async () => moveBooking(openDb(path), b.id, target, { now: NOW }))(),
  ]);
  expect(results.filter((r) => r.ok)).toHaveLength(1);
  expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "taken" }]);
  const rows = openDb(path).select().from(bookings).all();
  expect(rows.filter((r) => r.start === target)).toHaveLength(1);
  // The loser keeps its old time.
  expect(rows.map((r) => r.start).sort()).toEqual(
    [target, results[0].ok ? at("2026-11-07T16:00") : at("2026-11-07T14:00")].sort(),
  );
  noOverlap(path);
});
