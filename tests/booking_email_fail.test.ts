// The push to Nina when an email to a dancer fails (#414): one push with the name of the dancer, none for a sent
// email, a failed push does not throw, and each kind of email has a text in English and Dutch.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import type { PushMessage } from "../src/lib/push";

const mail = vi.hoisted(() => ({ fail: false }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async () => {
    if (mail.fail) throw new Error("Mailgun down");
  }),
}));
const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);

const { sendDecisionEmail } = await import("../src/lib/booking-email");
const { EMAIL_KINDS, emailFailPush, sendEmailFailPush } = await import("../src/lib/booking-push");
const { checkReminders } = await import("../src/lib/booking-reminder");

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
let db: Db;
let offerId: number;

beforeEach(() => {
  mail.fail = false;
  push.sendPush.mockReset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start = "2026-10-25T10:00", change: Partial<typeof bookings.$inferInsert> = {}) {
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

function pushed(locale: "en" | "nl"): PushMessage {
  const make = push.sendPush.mock.calls[0][1] as (l: string) => PushMessage;
  return make(locale);
}

test("a failed decision email sends one push with the name of the dancer", async () => {
  mail.fail = true;
  await sendDecisionEmail(db, book(), "approved");
  expect(push.sendPush).toHaveBeenCalledTimes(1);
  const message = pushed("en");
  expect(message.body).toContain("Ana");
  expect(message.title).toBe("Email not sent");
  // Sunday 2026-10-25 (the end of summer time) is in the week of Monday 2026-10-19.
  expect(message.url).toBe("/studio/week?start=2026-10-19");
});

test("a sent email sends no push", async () => {
  await sendDecisionEmail(db, book(), "approved");
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("a failed push does not throw", async () => {
  push.sendPush.mockRejectedValue(new Error("push down"));
  await expect(sendEmailFailPush(db, book(), "decision")).resolves.toBeUndefined();
});

test("a forgotten booking gets no push", async () => {
  await sendEmailFailPush(db, book("2026-10-25T10:00", { forgottenAt: at("2026-10-26T10:00") }), "cancel");
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("each kind has a text in English and Dutch", () => {
  const booking = book();
  for (const kind of EMAIL_KINDS) {
    const en = emailFailPush(booking, kind, "en");
    const nl = emailFailPush(booking, kind, "nl");
    expect(en.body).toContain("Ana");
    expect(nl.body).toContain("Ana");
    expect(nl.body).not.toBe(en.body);
    expect(nl.title).toBe("E-mail niet verstuurd");
  }
  const bodies = EMAIL_KINDS.map((kind) => emailFailPush(booking, kind, "en").body);
  expect(new Set(bodies).size).toBe(EMAIL_KINDS.length);
});

test("a failed reminder email sends one push", async () => {
  book("2026-11-14T18:00");
  mail.fail = true;
  await expect(checkReminders(db, at("2026-11-13T18:00"))).rejects.toThrow("Mailgun down");
  expect(push.sendPush).toHaveBeenCalledTimes(1);
  expect(pushed("nl").body).toBe("Ana kreeg de herinnering niet.");
});
