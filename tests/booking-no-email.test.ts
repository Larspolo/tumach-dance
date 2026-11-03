// A booking with no email address gets no email of any kind and no push of a failed email (#618). A booking with an
// email still gets each of them. Covers the decision, cancel and move emails and the reminder, payment and unanswered
// emails of the booking timers.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { sendCancelEmail, sendDecisionEmail, sendMoveEmail } from "../src/lib/booking-email";
import { checkReminders } from "../src/lib/booking-reminder";
import { checkUnanswered } from "../src/lib/booking-unanswered";
import type { Email } from "../src/lib/email";
import { checkPaymentReminders } from "../src/lib/payment-reminder";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));
const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  push.sendPush.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start: at(start),
      end: at(start) + HOUR,
      status: "approved",
      name: "Ana",
      email: "",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: at(start) - 7 * 24 * HOUR,
      approvedAt: at("2026-11-02T12:00"),
      ...change,
    })
    .returning()
    .get();
}

function bookingWithEmail(start: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  return book(start, { email: "ana@example.com", ...change });
}

test("a decision, cancel and move email to a booking with no email address sends nothing", async () => {
  const booking = book("2026-11-20T18:00");
  await sendDecisionEmail(db, booking, "approved");
  await sendDecisionEmail(db, booking, "declined");
  await sendCancelEmail(db, booking, "nina", true);
  await sendMoveEmail(db, booking, { start: at("2026-11-19T18:00"), end: at("2026-11-19T18:00") + HOUR });
  expect(mail.sent).toEqual([]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("a decision, cancel and move email to a booking with an email address is sent", async () => {
  const booking = bookingWithEmail("2026-11-20T18:00");
  await sendDecisionEmail(db, booking, "approved");
  await sendCancelEmail(db, booking, "nina", true);
  await sendMoveEmail(db, booking, { start: at("2026-11-19T18:00"), end: at("2026-11-19T18:00") + HOUR });
  expect(mail.sent.map((email) => email.to)).toEqual(["ana@example.com", "ana@example.com", "ana@example.com"]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("the reminder to a booking with no email address is claimed but sends nothing", async () => {
  const booking = book("2026-11-14T18:00");
  expect(await checkReminders(db, at("2026-11-13T18:00"))).toEqual([booking.id]);
  expect(mail.sent).toEqual([]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("the reminder to a booking with an email address is sent", async () => {
  const booking = bookingWithEmail("2026-11-14T18:00");
  expect(await checkReminders(db, at("2026-11-13T18:00"))).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
});

test("the payment reminder to a booking with no email address is claimed but sends nothing", async () => {
  const booking = book("2026-11-20T18:00");
  expect(await checkPaymentReminders(db, at("2026-11-02T12:00") + 48 * HOUR)).toEqual([booking.id]);
  expect(mail.sent).toEqual([]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("the payment reminder to a booking with an email address is sent", async () => {
  const booking = bookingWithEmail("2026-11-20T18:00");
  expect(await checkPaymentReminders(db, at("2026-11-02T12:00") + 48 * HOUR)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
});

test("the unanswered email to a booking with no email address is not sent, the request still ends", async () => {
  const start = at("2026-11-14T18:00");
  const booking = book("2026-11-14T18:00", { status: "requested", approvedAt: null });
  expect(await checkUnanswered(db, start + HOUR / 60)).toEqual([booking.id]);
  expect(mail.sent).toEqual([]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("the unanswered email to a booking with an email address is sent", async () => {
  const start = at("2026-11-14T18:00");
  const booking = bookingWithEmail("2026-11-14T18:00", { status: "requested", approvedAt: null });
  expect(await checkUnanswered(db, start + HOUR / 60)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
});
