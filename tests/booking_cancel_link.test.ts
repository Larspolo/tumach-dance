// The cancel link of the dancer (#164): the token of a booking, the rule of #163 (any time before the start, also at
// the change of summer time), the page states and the link in the emails.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { expect, test } from "vitest";
import { type Db, MIGRATIONS_FOLDER, openDb } from "../src/db";
import { type BookingInput, decideBooking, requestBooking } from "../src/db/bookings";
import { runMigrations } from "../src/db/migrate";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { cancelByDancer, cancelLink, cancelUrl, dancerCanCancel } from "../src/lib/booking-cancel";
import { cancelEmail, decisionEmail, requestEmail } from "../src/lib/booking-email";

// The default rule: Saturday and Sunday open all day (10:00 to 22:00).
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone: "Europe/Amsterdam" }).toMillis();
const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const utc = (iso: string) => DateTime.fromISO(iso, { zone: "utc" }).toMillis();

function setup(db: Db = openDb(":memory:")) {
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const input: BookingInput = {
    offerId: offer.id,
    start: at("2026-11-07T14:00"),
    end: at("2026-11-07T15:00"),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 1234 5678",
    locale: "nl",
  };
  const result = requestBooking(db, input, { now: NOW });
  if (!result.ok) throw new Error("the request must be stored");
  return { db, offer, booking: result.booking };
}

test("each booking gets its own token of 32 random bytes in base64url", () => {
  const { db, booking } = setup();
  expect(booking.cancelToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
  const other = requestBooking(
    db,
    { ...booking, start: at("2026-11-07T16:00"), end: at("2026-11-07T17:00") },
    { now: NOW },
  );
  if (!other.ok) throw new Error("the second request must be stored");
  expect(other.booking.cancelToken).not.toBe(booking.cancelToken);
});

test("the link has the locale and the token, never the id alone", () => {
  const { booking } = setup();
  const url = new URL(cancelUrl("https://tumach.dance", booking));
  expect(url.origin + url.pathname).toBe("https://tumach.dance/nl/booking/cancel");
  expect([...url.searchParams.keys()]).toEqual(["token"]);
  expect(url.searchParams.get("token")).toBe(booking.cancelToken);
});

test("the dancer can cancel until the start, not at or after it", () => {
  const start = at("2026-11-07T14:00");
  expect(dancerCanCancel(start, start - 1)).toBe(true);
  expect(dancerCanCancel(start, start)).toBe(false);
  expect(dancerCanCancel(start, start + 60_000)).toBe(false);
});

test("the rule counts real time at the start of summer time (02:00 → 03:00)", () => {
  // 29 March 2026: 01:59 CET is 00:59 UTC, 03:00 CEST is 01:00 UTC.
  const start = at("2026-03-29T03:00");
  expect(start).toBe(utc("2026-03-29T01:00"));
  expect(dancerCanCancel(start, at("2026-03-29T01:59"))).toBe(true);
  expect(dancerCanCancel(start, start)).toBe(false);
});

test("the rule counts real time at the end of summer time (02:30 twice)", () => {
  // 25 October 2026: 02:30 CEST is 00:30 UTC, the second 02:30 (CET) is 01:30 UTC.
  const start = utc("2026-10-25T01:30");
  expect(dancerCanCancel(start, utc("2026-10-25T00:30"))).toBe(true);
  expect(dancerCanCancel(start, utc("2026-10-25T01:29"))).toBe(true);
  expect(dancerCanCancel(start, utc("2026-10-25T01:30"))).toBe(false);
});

test("opening the link only reads: the booking stays as it is", () => {
  const { db, booking } = setup();
  expect(cancelLink(db, booking.cancelToken, NOW)).toMatchObject({ state: "open", booking: { id: booking.id } });
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe("requested");
});

test("the right token before the start cancels the booking once", () => {
  const { db, booking } = setup();
  decideBooking(db, booking.id, "approved");
  expect(cancelByDancer(db, booking.cancelToken, NOW)).toMatchObject({ ok: true, booking: { status: "cancelled" } });
  expect(cancelByDancer(db, booking.cancelToken, NOW)).toEqual({ ok: false, state: "cancelled" });
  expect(cancelLink(db, booking.cancelToken, NOW).state).toBe("cancelled");
});

test("a wrong, changed, empty or long token cancels nothing", () => {
  const { db, booking } = setup();
  const changed = `${booking.cancelToken.slice(0, -1)}${booking.cancelToken.endsWith("A") ? "B" : "A"}`;
  for (const token of [changed, "", String(booking.id), "x".repeat(500), `${booking.cancelToken}'--`]) {
    expect(cancelByDancer(db, token, NOW)).toEqual({ ok: false, state: "not-found" });
  }
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe("requested");
});

test("after the start, the link cancels nothing", () => {
  const { db, booking } = setup();
  decideBooking(db, booking.id, "approved");
  expect(cancelByDancer(db, booking.cancelToken, booking.start)).toEqual({ ok: false, state: "started" });
  expect(db.select().from(bookings).where(eq(bookings.id, booking.id)).get()?.status).toBe("approved");
});

test("a declined booking cannot be cancelled", () => {
  const { db, booking } = setup();
  decideBooking(db, booking.id, "declined");
  expect(cancelByDancer(db, booking.cancelToken, NOW)).toEqual({ ok: false, state: "declined" });
});

test("the token of an old row (hex of the migration) works", () => {
  const { db, booking } = setup();
  const hex = "ab".repeat(32);
  db.update(bookings).set({ cancelToken: hex }).where(eq(bookings.id, booking.id)).run();
  expect(cancelLink(db, hex, NOW).state).toBe("open");
});

test("the migration gives each old row its own token, and the unique index refuses a copy", () => {
  // The migrations before #164 in a copy of `drizzle/`, two old rows, then all migrations.
  const dir = mkdtempSync(join(tmpdir(), "tumach-cancel-"));
  try {
    cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
    const journalPath = join(dir, "meta/_journal.json");
    const journal = JSON.parse(readFileSync(journalPath, "utf8"));
    const last = journal.entries.findIndex((e: { tag: string }) => e.tag.startsWith("0014_"));
    writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.slice(0, last) }));
    const sqlite = new Database(":memory:");
    runMigrations(sqlite, dir);
    sqlite.exec("INSERT INTO offers (kind, minutes, price_cents, position) VALUES ('lesson', 60, 6000, 0)");
    const insert = sqlite.prepare(
      "INSERT INTO bookings (offer_id, start, end, name, email, phone, locale, created_at) VALUES (1, ?, ?, 'Old', 'o@example.com', '+31 6 1234 5678', 'en', 0)",
    );
    insert.run(1000, 2000);
    insert.run(3000, 4000);
    runMigrations(sqlite, MIGRATIONS_FOLDER);
    const rows = sqlite.prepare("SELECT cancel_token AS token FROM bookings").all() as { token: string }[];
    expect(rows).toHaveLength(2);
    for (const { token } of rows) expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0].token).not.toBe(rows[1].token);
    expect(() =>
      sqlite
        .prepare(
          "INSERT INTO bookings (offer_id, start, end, name, email, phone, locale, created_at, cancel_token) VALUES (1, 5000, 6000, 'Copy', 'c@example.com', '+31 6 1234 5678', 'en', 0, ?)",
        )
        .run(rows[0].token),
    ).toThrow(/UNIQUE/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the request and the approval email have the cancel link; the decline email has none", () => {
  const { db, offer, booking } = setup();
  const link = cancelUrl("https://tumach.dance", booking);
  expect(requestEmail(booking, offer, "nl", "https://tumach.dance").text).toContain(link);
  const approved = decideBooking(db, booking.id, "approved");
  if (!approved.ok) throw new Error("the approval must work");
  expect(decisionEmail(approved.booking, offer, "approved", "https://tumach.dance").text).toContain(link);
  expect(decisionEmail(approved.booking, offer, "declined", "https://tumach.dance").text).not.toContain(link);
});

test("the cancel email says who cancelled", () => {
  const { offer, booking } = setup();
  const en = { ...booking, locale: "en" };
  expect(cancelEmail(en, offer, "dancer").text).toContain("You cancelled your booking");
  expect(cancelEmail(en, offer).text).toContain("Nina cancelled your booking");
});
