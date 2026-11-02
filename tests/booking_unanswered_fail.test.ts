// A failed email of an unanswered request (#421): one push to Nina with the name of the dancer, the request stays
// ended (no retry), and a sent email gives no push.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import type { PushMessage } from "../src/lib/push";

const mail = vi.hoisted(() => ({ fail: false, sends: 0 }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async () => {
    mail.sends += 1;
    if (mail.fail) throw new Error("Mailgun down");
  }),
}));
const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);

const { checkUnanswered } = await import("../src/lib/booking-unanswered");

const MINUTE = 60_000;
const start = DateTime.fromISO("2026-11-14T18:00", { zone: "Europe/Amsterdam" }).toMillis();
let db: Db;
let offerId: number;

beforeEach(() => {
  mail.fail = false;
  mail.sends = 0;
  push.sendPush.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book() {
  return db
    .insert(bookings)
    .values({
      offerId,
      start,
      end: start + 60 * MINUTE,
      status: "requested",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: start - 7 * 24 * 60 * MINUTE,
    })
    .returning()
    .get();
}

const status = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get()?.status;

test("a failed send gives one push, the request stays declined, and the next check does nothing", async () => {
  const booking = book();
  mail.fail = true;
  expect(await checkUnanswered(db, start + MINUTE)).toEqual([booking.id]);
  expect(status(booking.id)).toBe("declined");
  expect(push.sendPush).toHaveBeenCalledTimes(1);
  const make = push.sendPush.mock.calls[0][1] as (l: string) => PushMessage;
  expect(make("en").body).toContain("Ana");
  expect(await checkUnanswered(db, start + 6 * MINUTE)).toEqual([]);
  expect(mail.sends).toBe(1);
  expect(push.sendPush).toHaveBeenCalledTimes(1);
});

test("a sent email gives no push", async () => {
  const booking = book();
  expect(await checkUnanswered(db, start + MINUTE)).toEqual([booking.id]);
  expect(mail.sends).toBe(1);
  expect(push.sendPush).not.toHaveBeenCalled();
});
