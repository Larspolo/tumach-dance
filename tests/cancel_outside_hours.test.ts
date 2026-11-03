// Nina cancels the bookings outside her open hours (#714, epic #711): each one is cancelled, each dancer with an email
// gets one cancel email in the language of the booking with the link to book another time, only an approved booking
// has the calendar file, and a booking moved inside the hours before the tap stays.
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { sendCancelDayEmails } from "../src/lib/booking-cancel-day";
import { cancelOutsideHours } from "../src/lib/bookings-outside-hours";
import type { Email } from "../src/lib/email";
import { saveHoursRule } from "../src/lib/hours-store";

const mail = vi.hoisted(() => ({ sent: [] as Email[] }));
vi.mock("../src/lib/email", () => ({
  sendEmail: vi.fn(async (email: Email) => {
    mail.sent.push(email);
  }),
}));

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const NOW = at("2026-11-18T12:00");
const HOUR = 60 * 60_000;

let db: Db;
let offerId: number;

beforeEach(() => {
  mail.sent = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
  // Open each day all day, but closed on 2026-11-20.
  const allDay = "allDay" as const;
  saveHoursRule(db, {
    weekly: { mon: allDay, tue: allDay, wed: allDay, thu: allDay, fri: allDay, sat: allDay, sun: allDay },
    closed: [{ from: "2026-11-20" }],
  });
});

function book(start: string, change: Partial<typeof bookings.$inferInsert>) {
  return db
    .insert(bookings)
    .values({
      offerId,
      priceCents: 6000,
      start: at(start),
      end: at(start) + HOUR,
      name: "Holiday Dancer",
      email: "dancer@example.com",
      phone: "",
      locale: "en",
      status: "approved",
      createdAt: NOW,
      ...change,
    })
    .returning()
    .get();
}

const status = (id: number) => db.select().from(bookings).where(eq(bookings.id, id)).get()?.status;

test("the cancel emails each dancer once, in the booking language, with the calendar file only when approved", async () => {
  const ana = book("2026-11-20T10:00", { name: "Ana", email: "ana@example.com", locale: "en", status: "approved" });
  const bo = book("2026-11-20T12:00", { name: "Bo", email: "bo@example.com", locale: "nl", status: "requested" });
  const eva = book("2026-11-20T14:00", { name: "Eva", email: "", status: "approved" });
  const inside = book("2026-11-21T10:00", { name: "Inside" });

  const cancelled = cancelOutsideHours(db, { now: NOW });
  expect(cancelled.map((c) => c.booking.id)).toEqual([ana.id, bo.id, eva.id]);
  expect(status(inside.id)).toBe("approved");

  await sendCancelDayEmails(db, cancelled);
  expect(mail.sent.map((email) => email.to)).toEqual(["ana@example.com", "bo@example.com"]);
  const [toAna, toBo] = mail.sent;
  expect(toAna.html).toMatch(/lang="en"/);
  expect(toBo.html).toMatch(/lang="nl"/);
  expect(toAna.html).toMatch(/\/en\b/);
  expect(toBo.html).toMatch(/\/nl\b/);
  expect(toAna.attachments?.length ?? 0).toBe(1);
  expect(toBo.attachments?.length ?? 0).toBe(0);
});

test("a booking moved inside the hours before the tap stays", () => {
  const moved = book("2026-11-20T10:00", {});
  db.update(bookings)
    .set({ start: at("2026-11-22T10:00"), end: at("2026-11-22T10:00") + HOUR })
    .where(eq(bookings.id, moved.id))
    .run();
  expect(cancelOutsideHours(db, { now: NOW })).toEqual([]);
  expect(status(moved.id)).toBe("approved");
});
