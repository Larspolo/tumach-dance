// The reminder email the day before an approved booking, and the booking timer (#165).
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { reminderEmail } from "../src/lib/booking-email";
import { checkReminders, reminderDue } from "../src/lib/booking-reminder";
import type { Email } from "../src/lib/email";

const mail = vi.hoisted(() => ({ sent: [] as Email[], fail: false }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    if (mail.fail) throw new Error("Mailgun down");
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  mail.fail = false;
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function book(start: string, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start: at(start),
      end: at(start) + HOUR,
      status: "approved",
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: at(start) - 7 * 24 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

test("the reminder is due at the same Amsterdam time one day before", () => {
  expect(reminderDue(at("2026-11-14T18:00"))).toBe(at("2026-11-13T18:00"));
  // The change to summer time (2027-03-28 02:00): 23 hours before.
  expect(reminderDue(at("2027-03-28T10:00"))).toBe(at("2027-03-27T10:00"));
  expect(at("2027-03-28T10:00") - reminderDue(at("2027-03-28T10:00"))).toBe(23 * HOUR);
  // The change to winter time (2026-10-25 03:00): 25 hours before.
  expect(at("2026-10-25T10:00") - reminderDue(at("2026-10-25T10:00"))).toBe(25 * HOUR);
});

test("an approved booking gets exactly one reminder, from the day before", async () => {
  const booking = book("2026-11-14T18:00");
  expect(await checkReminders(db, at("2026-11-13T17:59"))).toEqual([]);
  expect(await checkReminders(db, at("2026-11-13T18:00"))).toEqual([booking.id]);
  // A second check, also a check after a restart (a new run of the same database), sends nothing.
  expect(await checkReminders(db, at("2026-11-13T18:05"))).toEqual([]);
  expect(await checkReminders(db, at("2026-11-14T09:00"))).toEqual([]);
  expect(mail.sent).toHaveLength(1);
  expect(mail.sent[0].to).toBe("ana@example.com");
  const row = db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
  expect(row?.remindedAt).toBe(at("2026-11-13T18:00"));
});

test("two checks at the same time send one reminder", async () => {
  book("2026-11-14T18:00");
  const now = at("2026-11-13T18:00");
  const [a, b] = await Promise.all([checkReminders(db, now), checkReminders(db, now)]);
  expect([...a, ...b]).toHaveLength(1);
  expect(mail.sent).toHaveLength(1);
});

test("a server that was down at the due time still sends the reminder before the start", async () => {
  const booking = book("2026-11-14T18:00");
  expect(await checkReminders(db, at("2026-11-14T12:00"))).toEqual([booking.id]);
});

test("requested, declined, cancelled and past bookings get no reminder", async () => {
  book("2026-11-14T12:00", { status: "requested" });
  book("2026-11-14T13:00", { status: "declined" });
  book("2026-11-14T14:00", { status: "cancelled" });
  book("2026-11-13T10:00");
  expect(await checkReminders(db, at("2026-11-13T20:00"))).toEqual([]);
  expect(mail.sent).toEqual([]);
});

test("a booking requested less than a day before its start gets no reminder", async () => {
  book("2026-11-14T18:00", { createdAt: at("2026-11-13T20:00") });
  expect(await checkReminders(db, at("2026-11-13T21:00"))).toEqual([]);
  // Requested exactly at the due moment: still a reminder.
  const booking = book("2026-11-14T19:00", { createdAt: at("2026-11-13T19:00") });
  expect(await checkReminders(db, at("2026-11-13T21:00"))).toEqual([booking.id]);
});

test("on the days of the change of summer time the reminder comes at the same wall time", async () => {
  const spring = book("2027-03-28T10:00");
  expect(await checkReminders(db, at("2027-03-27T09:59"))).toEqual([]);
  expect(await checkReminders(db, at("2027-03-27T10:00"))).toEqual([spring.id]);
  const autumn = book("2026-10-25T10:00");
  expect(await checkReminders(db, at("2026-10-24T09:59"))).toEqual([]);
  expect(await checkReminders(db, at("2026-10-24T10:00"))).toEqual([autumn.id]);
});

test("a failed send gives the reminder back to the next check", async () => {
  const booking = book("2026-11-14T18:00");
  mail.fail = true;
  await expect(checkReminders(db, at("2026-11-13T18:00"))).rejects.toThrow("Mailgun down");
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.remindedAt).toBeNull();
  mail.fail = false;
  expect(await checkReminders(db, at("2026-11-13T18:05"))).toEqual([booking.id]);
});

test("the reminder email is in the language of the booking, with the Amsterdam time", () => {
  const booking = book("2026-11-14T18:00");
  const offer = { id: offerId, kind: "lesson", minutes: 60, priceCents: 6000, position: 0, visible: true } as const;
  const email = reminderEmail(booking, offer);
  expect(email.subject).toBe("Herinnering: je boeking bij TUMACH");
  expect(email.text).toContain("Hoi Ana,");
  expect(email.text).toContain("18:00");
  expect(reminderEmail({ ...booking, locale: "en" }, offer).subject).toBe("Reminder: your booking at TUMACH");
});

test("the booking timer starts once per process, with no GITHUB_TOKEN", async () => {
  const setInterval = vi.fn(() => ({ unref: vi.fn() }));
  vi.stubGlobal("setInterval", setInterval);
  const { startBookingTimer } = await import("../src/lib/booking-timer");
  const first = startBookingTimer(db);
  expect(startBookingTimer(db)).toBe(first);
  expect(setInterval).toHaveBeenCalledTimes(1);
});

test("register() starts the booking timer with no GITHUB_TOKEN", async () => {
  vi.resetModules();
  const start = vi.fn();
  vi.doMock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => db }));
  vi.doMock("../src/lib/booking-timer", () => ({ startBookingTimer: start }));
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  vi.stubEnv("GITHUB_TOKEN", "");
  const { register } = await import("../src/instrumentation");
  await register();
  expect(start).toHaveBeenCalledWith(db);
  vi.unstubAllEnvs();
  vi.doUnmock("../src/db");
  vi.doUnmock("../src/lib/booking-timer");
});
