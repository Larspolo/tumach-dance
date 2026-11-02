// The one extra push to Nina for a request that still waits 12 hours before its start (#594).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import en from "../messages/en.json";
import nl from "../messages/nl.json";
import { type Db, openDb } from "../src/db";
import { decideBooking, undoDecision } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { checkNudges } from "../src/lib/booking-nudge";
import type { PushMessage } from "../src/lib/push";

const push = vi.hoisted(() => ({ sent: [] as PushMessage[], fail: false }));
vi.mock("../src/lib/push", () => ({
  sendPush: vi.fn(async (_db: unknown, message: (locale: "en") => PushMessage) => {
    if (push.fail) throw new Error("push down");
    push.sent.push(message("en"));
    return 1;
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  push.sent = [];
  push.fail = false;
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

/** A request made `ageHours` before `now`, with its start `inHours` after `now`. */
function request(now: number, inHours: number, ageHours: number, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: now + inHours * HOUR,
      end: now + (inHours + 1) * HOUR,
      status: "requested",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: now - ageHours * HOUR,
      ...change,
    })
    .returning()
    .get();
}

const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

test("a request that still waits gets one push with the name and the time", async () => {
  const now = at("2026-11-14T14:00");
  const booking = request(now, 11, 3);
  expect(await checkNudges(db, now)).toEqual([booking.id]);
  expect(push.sent).toHaveLength(1);
  expect(push.sent[0].title).toBe("A request still waits");
  expect(push.sent[0].body).toContain("Ana");
  expect(push.sent[0].body).toContain("1:00");
  expect(push.sent[0].url).toBe("/studio/bookings");
  expect(row(booking.id)?.nudgedAt).toBe(now);
  expect(await checkNudges(db, now + 5 * 60_000)).toEqual([]);
  expect(push.sent).toHaveLength(1);
});

test("two checks at the same time send one push", async () => {
  const now = at("2026-11-14T14:00");
  request(now, 11, 3);
  const [a, b] = await Promise.all([checkNudges(db, now), checkNudges(db, now)]);
  expect([...a, ...b]).toHaveLength(1);
  expect(push.sent).toHaveLength(1);
});

test("no push for a far, a new, a decided, a forgotten or a past request", async () => {
  const now = at("2026-11-14T14:00");
  request(now, 13, 3);
  request(now, 11, 1);
  request(now, 11, 3, { status: "approved" });
  request(now, 11, 3, { status: "declined" });
  request(now, 11, 3, { forgottenAt: now - HOUR });
  request(now, -1, 30);
  expect(await checkNudges(db, now)).toEqual([]);
  expect(push.sent).toHaveLength(0);
});

test("no push at night: 22:00 and 07:59 no, 08:00 yes (end of summer time)", async () => {
  const booking = request(at("2026-10-25T08:00"), 6, 5);
  expect(await checkNudges(db, at("2026-10-24T22:00"))).toEqual([]);
  expect(await checkNudges(db, at("2026-10-25T07:59"))).toEqual([]);
  expect(await checkNudges(db, at("2026-10-25T08:00"))).toEqual([booking.id]);
});

test("no push at night: 07:59 no, 08:00 yes (start of summer time)", async () => {
  const booking = request(at("2027-03-28T08:00"), 6, 5);
  expect(await checkNudges(db, at("2027-03-28T07:59"))).toEqual([]);
  expect(await checkNudges(db, at("2027-03-28T08:00"))).toEqual([booking.id]);
});

test("a failed push is not sent again", async () => {
  const now = at("2026-11-14T14:00");
  const booking = request(now, 11, 3);
  push.fail = true;
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(await checkNudges(db, now)).toEqual([booking.id]);
  push.fail = false;
  expect(await checkNudges(db, now + 5 * 60_000)).toEqual([]);
  expect(push.sent).toHaveLength(0);
});

test("after an undo of a nudged request no second push", async () => {
  const now = at("2026-11-14T14:00");
  const booking = request(now, 11, 3);
  await checkNudges(db, now);
  decideBooking(db, booking.id, "approved", null, now + 60_000);
  expect(undoDecision(db, booking.id, now + 90_000).ok).toBe(true);
  expect(row(booking.id)?.status).toBe("requested");
  expect(await checkNudges(db, now + HOUR)).toEqual([]);
  expect(push.sent).toHaveLength(1);
});

test("the texts are in English and Dutch", () => {
  expect(en.bookingPush.nudgeTitle).toBeTruthy();
  expect(nl.bookingPush.nudgeTitle).toBeTruthy();
});
