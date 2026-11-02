// The undo time of Nina's decision (#572, epic #568): the decision email goes once when the undo time ends, an undone
// decision sends none, `undoDecision()` refuses with a reason, and no reminder comes before the decision email.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addBlock } from "../src/db/blocks";
import {
  type BookingInput,
  claimDueDecisions,
  decideBooking,
  requestBooking,
  UNDO_MS,
  undoDecision,
} from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { checkReminders } from "../src/lib/booking-reminder";
import { sendDueDecisionEmails } from "../src/lib/decision-mail";
import type { Email } from "../src/lib/email";
import { saveHoursRule } from "../src/lib/hours-store";
import { checkPaymentReminders } from "../src/lib/payment-reminder";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-10-20T12:00");
// Sunday 2026-10-25: the day that summer time ends.
const START = at("2026-10-25T10:00");
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

function request(name: string, email: string, now = NOW) {
  const input: BookingInput = {
    offerId,
    start: START,
    end: START + HOUR,
    name,
    email,
    phone: "+31 6 12345678",
    locale: "en",
  };
  const result = requestBooking(db, input, { now });
  if (!result.ok) throw new Error(`the request should be ok: ${result.reason}`);
  return result.booking;
}

const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

beforeEach(() => {
  mail.sent = [];
  db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

test("the decision email goes once when the undo time ends, not before", async () => {
  const booking = request("Ana", "ana@example.com");
  expect(decideBooking(db, booking.id, "approved", null, NOW).ok).toBe(true);

  expect(await sendDueDecisionEmails(db, NOW + UNDO_MS - 1)).toEqual([]);
  expect(mail.sent).toHaveLength(0);

  // Two callers at the same instant (the timer of the tap and the booking timer): one email.
  const [first, second] = await Promise.all([
    sendDueDecisionEmails(db, NOW + UNDO_MS),
    sendDueDecisionEmails(db, NOW + UNDO_MS),
  ]);
  expect([...first, ...second]).toEqual([booking.id]);
  expect(await sendDueDecisionEmails(db, NOW + 10 * UNDO_MS)).toEqual([]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0]).toMatchObject({ to: "ana@example.com", subject: "Your booking at TUMACH is confirmed" });
  expect(row(booking.id)?.decisionMailedAt).toBe(NOW + UNDO_MS);
});

test("a decline sends the decline email after the undo time", async () => {
  const booking = request("Ana", "ana@example.com");
  decideBooking(db, booking.id, "declined", null, NOW);

  expect(await sendDueDecisionEmails(db, NOW + UNDO_MS)).toEqual([booking.id]);
  expect(mail.sent[0].text).toContain("Sorry, Nina cannot take your request");
});

test("an undone decision is a request again and sends no email", async () => {
  const booking = request("Ana", "ana@example.com");
  decideBooking(db, booking.id, "approved", "https://tikkie.me/pay/abc", NOW);

  const undone = undoDecision(db, booking.id, NOW + UNDO_MS - 1);
  expect(undone).toMatchObject({ ok: true, booking: { id: booking.id, status: "requested" } });
  expect(row(booking.id)).toMatchObject({ status: "requested", approvedAt: null, tikkieUrl: null, decidedAt: null });
  expect(await sendDueDecisionEmails(db, NOW + 10 * UNDO_MS)).toEqual([]);
  expect(mail.sent).toHaveLength(0);

  // A new decision has its own undo time and its own email.
  decideBooking(db, booking.id, "declined", null, NOW + 2 * UNDO_MS);
  expect(await sendDueDecisionEmails(db, NOW + 2 * UNDO_MS + UNDO_MS)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].text).toContain("Sorry, Nina cannot take your request");
});

test("undoDecision refuses after the undo time or after the email", () => {
  const late = request("Ana", "ana@example.com");
  decideBooking(db, late.id, "approved", null, NOW);
  expect(undoDecision(db, late.id, NOW + UNDO_MS)).toEqual({ ok: false, reason: "sent" });

  db.update(bookings).set({ status: "requested", decidedAt: null }).where(eq(bookings.id, late.id)).run();
  decideBooking(db, late.id, "approved", null, NOW);
  // The claim of the email came first (a clock of another caller that is a little ahead).
  expect(claimDueDecisions(db, NOW + UNDO_MS).map((b) => b.id)).toEqual([late.id]);
  expect(undoDecision(db, late.id, NOW + 1_000)).toEqual({ ok: false, reason: "sent" });
  expect(row(late.id)?.status).toBe("approved");
});

test("undoDecision refuses a booking that is not decided, not found or started", () => {
  const open = request("Ana", "ana@example.com");
  expect(undoDecision(db, open.id, NOW)).toEqual({ ok: false, reason: "not-decided" });
  expect(undoDecision(db, 999, NOW)).toEqual({ ok: false, reason: "not-found" });

  // A decision before #572 has no undo time.
  db.update(bookings).set({ status: "approved" }).where(eq(bookings.id, open.id)).run();
  expect(undoDecision(db, open.id, NOW)).toEqual({ ok: false, reason: "not-decided" });

  db.update(bookings).set({ status: "requested" }).where(eq(bookings.id, open.id)).run();
  decideBooking(db, open.id, "approved", null, START - 1_000);
  expect(undoDecision(db, open.id, START)).toEqual({ ok: false, reason: "started" });
});

test("the undo of a decline whose time another dancer took gives taken", () => {
  const first = request("Ana", "ana@example.com");
  decideBooking(db, first.id, "declined", null, NOW);
  // The declined time is free at once: another dancer requests it inside the undo time.
  const second = request("Bo", "bo@example.com", NOW + 1_000);

  expect(undoDecision(db, first.id, NOW + 2_000)).toEqual({ ok: false, reason: "taken" });
  expect(row(first.id)?.status).toBe("declined");
  expect(row(second.id)?.status).toBe("requested");
});

test("the undo of a decline whose time Nina blocked gives taken", () => {
  const first = request("Ana", "ana@example.com");
  decideBooking(db, first.id, "declined", null, NOW);
  addBlock(db, { start: START, end: START + HOUR });

  expect(undoDecision(db, first.id, NOW + 1_000)).toEqual({ ok: false, reason: "taken" });
});

test("the undo of an approval: its own time does not count as taken", () => {
  const booking = request("Ana", "ana@example.com");
  decideBooking(db, booking.id, "approved", null, NOW);

  expect(undoDecision(db, booking.id, NOW + 1_000).ok).toBe(true);
});

afterEach(() => vi.useRealTimers());

test("no reminder before the decision email", async () => {
  const booking = request("Ana", "ana@example.com");
  // Nina approves the day before, after the time of the reminder: the reminder is due at once.
  const decided = START - 20 * HOUR;
  decideBooking(db, booking.id, "approved", null, decided);

  expect(await checkReminders(db, decided + 1_000)).toEqual([]);
  await sendDueDecisionEmails(db, decided + UNDO_MS);
  expect(await checkReminders(db, decided + UNDO_MS + 1_000)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(2);
  expect(mail.sent[0].subject).toBe("Your booking at TUMACH is confirmed");
});

test("no payment reminder while the decision email did not go", async () => {
  const booking = request("Ana", "ana@example.com");
  const decided = START - 20 * HOUR;
  // `approvedAt` is the clock of the approval; the payment reminder is due 2 hours after it.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(decided);
  decideBooking(db, booking.id, "approved", null, decided);

  expect(await checkPaymentReminders(db, decided + 3 * HOUR)).toEqual([]);
  claimDueDecisions(db, decided + UNDO_MS);
  expect(await checkPaymentReminders(db, decided + 3 * HOUR)).toEqual([booking.id]);
});

test("an approval before #572 (no decidedAt) gets no decision email again, and its reminder still goes", async () => {
  const booking = request("Ana", "ana@example.com");
  db.update(bookings).set({ status: "approved", approvedAt: NOW }).where(eq(bookings.id, booking.id)).run();

  expect(await sendDueDecisionEmails(db, START - 20 * HOUR)).toEqual([]);
  expect(await checkReminders(db, START - 20 * HOUR)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
});

test("a dancer whose data Nina removed in the undo time gets no email, and Nina's cancel stops the email", async () => {
  const forgotten = request("Ana", "ana@example.com");
  decideBooking(db, forgotten.id, "declined", null, NOW);
  db.update(bookings)
    .set({ forgottenAt: NOW + 1_000, email: "" })
    .where(eq(bookings.id, forgotten.id))
    .run();

  const cancelled = request("Bo", "bo@example.com");
  decideBooking(db, cancelled.id, "approved", null, NOW);
  db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, cancelled.id)).run();

  expect(await sendDueDecisionEmails(db, NOW + UNDO_MS)).toEqual([forgotten.id]);
  expect(mail.sent).toHaveLength(0);
});
