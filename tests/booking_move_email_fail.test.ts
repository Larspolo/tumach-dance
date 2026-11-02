// The push to Nina when the move email to a dancer fails (#427): one push with the name of the dancer, none for a
// sent move email. Same mocks as `booking_email_fail.test.ts` (#414).
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, moveBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { sendMoveEmail } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";
import type { PushMessage } from "../src/lib/push";

const mail = vi.hoisted(() => ({ fail: false }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async () => {
    if (mail.fail) throw new Error("Mailgun down");
  }),
}));
const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const HOUR = 60 * 60_000;
let db: Db;
let offerId: number;

beforeEach(() => {
  mail.fail = false;
  push.sendPush.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "17:00" } } });
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function at(local: string): number {
  return DateTime.fromISO(local, { zone }).toMillis();
}

/** An approved booking of Ana on Sunday 25 October at 10:00, moved to Sunday 1 November at 14:00. */
function moved() {
  const start = at("2026-10-25T10:00");
  const result = requestBooking(
    db,
    { offerId, start, end: start + HOUR, name: "Ana", email: "ana@example.com", phone: "+31 6 12345678", locale: "nl" },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  const decided = decideBooking(db, result.booking.id, "approved", null, NOW);
  if (!decided.ok) throw new Error(`the approval should be ok: ${decided.reason}`);
  const move = moveBooking(db, decided.booking.id, at("2026-11-01T14:00"), { now: NOW });
  if (!move.ok) throw new Error(`the move should be ok: ${move.reason}`);
  return { booking: move.booking, from: { start, end: start + HOUR } };
}

function pushed(locale: "en" | "nl"): PushMessage {
  const make = push.sendPush.mock.calls[0][1] as (l: string) => PushMessage;
  return make(locale);
}

test("a failed move email sends one push with the name of the dancer", async () => {
  const { booking, from } = moved();
  mail.fail = true;
  await sendMoveEmail(db, booking, from);
  expect(push.sendPush).toHaveBeenCalledTimes(1);
  const message = pushed("en");
  expect(message.body).toContain("Ana");
  expect(message.body).toBe("Ana did not get the email with the new time.");
  expect(message.title).toBe("Email not sent");
});

test("a sent move email sends no push", async () => {
  const { booking, from } = moved();
  await sendMoveEmail(db, booking, from);
  expect(push.sendPush).not.toHaveBeenCalled();
});
