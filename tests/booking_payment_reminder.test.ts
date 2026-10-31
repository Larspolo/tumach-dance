// The payment reminder to a dancer who did not pay an approved booking (#167): exactly one, with a fake clock.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, markPaid } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import type { Email } from "../src/lib/email";
import { checkPaymentReminders, paymentReminderDue } from "../src/lib/payment-reminder";

const mail = vi.hoisted(() => ({ sent: [] as Email[], fail: false }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    if (mail.fail) throw new Error("Mailgun down");
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
const APPROVED = at("2026-11-02T12:00");

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  mail.fail = false;
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: at(start),
      end: at(start) + HOUR,
      status: "approved",
      approvedAt: APPROVED,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "en",
      createdAt: APPROVED - HOUR,
      tikkieUrl: "https://tikkie.me/pay/x",
      ...change,
    })
    .returning()
    .get();
}

const row = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get();

test("due 2 days after the approval, at the latest 1 day before the start, at least 2 hours after the approval", () => {
  expect(paymentReminderDue(APPROVED, at("2026-11-20T18:00"))).toBe(APPROVED + 48 * HOUR);
  expect(paymentReminderDue(APPROVED, at("2026-11-03T18:00"))).toBe(at("2026-11-02T18:00"));
  expect(paymentReminderDue(APPROVED, at("2026-11-02T20:00"))).toBe(APPROVED + 2 * HOUR);
});

test("an unpaid approved booking gets exactly one reminder, also after a restart", async () => {
  const booking = book("2026-11-20T18:00");
  expect(await checkPaymentReminders(db, APPROVED + 47 * HOUR)).toEqual([]);
  expect(await checkPaymentReminders(db, APPROVED + 48 * HOUR)).toEqual([booking.id]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
  expect(mail.sent[0].text).toContain("https://tikkie.me/pay/x");
  expect(mail.sent[0].text).toContain("€60.00");
  // A restart: a new check on the same database, later.
  expect(await checkPaymentReminders(db, APPROVED + 60 * HOUR)).toEqual([]);
  expect(mail.sent).toHaveLength(1);
  expect(row(booking.id)?.paymentRemindedAt).toBe(APPROVED + 48 * HOUR);
});

test("a paid, cancelled, declined or past booking gets no reminder", async () => {
  const paid = book("2026-11-20T18:00");
  markPaid(db, paid.id, APPROVED + HOUR);
  book("2026-11-20T18:00", { status: "cancelled" });
  book("2026-11-20T18:00", { status: "declined" });
  book("2026-11-03T10:00");
  expect(await checkPaymentReminders(db, at("2026-11-04T12:00"))).toEqual([]);
  expect(mail.sent).toEqual([]);
});

test("a failed send clears the claim: the next check tries again", async () => {
  const booking = book("2026-11-20T18:00");
  mail.fail = true;
  await expect(checkPaymentReminders(db, APPROVED + 48 * HOUR)).rejects.toThrow("Mailgun down");
  expect(row(booking.id)?.paymentRemindedAt).toBeNull();
  mail.fail = false;
  expect(await checkPaymentReminders(db, APPROVED + 49 * HOUR)).toEqual([booking.id]);
});

test("decideBooking stores the approval time", () => {
  const booking = book("2026-11-20T18:00", { status: "requested", approvedAt: null });
  const before = Date.now();
  decideBooking(db, booking.id, "approved");
  expect(row(booking.id)?.approvedAt).toBeGreaterThanOrEqual(before);
});
