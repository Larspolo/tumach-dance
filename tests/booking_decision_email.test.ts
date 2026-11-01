// The email to the dancer after Nina's decision (#77): approved or declined, in the language of the booking, in
// Amsterdam time, sent by the requests page, and a failed email that keeps the decision.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { saveHoursRule } from "../src/lib/hours-store";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("../src/lib/auth", () => ({ getStudioSession: async () => ({ user: { email: "nina@example.com" } }) }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));

const { decisionEmail } = await import("../src/lib/booking-email");
const { decide } = await import("../src/app/studio/bookings/actions");

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
// Sunday 2026-10-25: the day that summer time ends. 10:00 local is 10:00 CET (09:00 UTC).
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

function booked(locale: string, db: Db = openDb(":memory:")) {
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
  const offer = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
  const result = requestBooking(
    db,
    {
      offerId: offer.id,
      start: START,
      end: START + 60 * 60_000,
      name: "Ana",
      email: "ana@example.com",
      phone: "+31 6 12345678",
      locale,
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  return { db, booking: result.booking, offer };
}

describe("decisionEmail", () => {
  test("English: approved and declined, with the offer and the Amsterdam time", () => {
    const { booking, offer } = booked("en");
    const approved = decisionEmail(booking, offer, "approved");
    expect(approved.to).toBe("ana@example.com");
    expect(approved.subject).toBe("Your booking at TUMACH is confirmed");
    expect(approved.text).toContain("Hi Ana,");
    expect(approved.text).toContain(
      "Nina approved your request: Private lesson, 60 min, Sunday, October 25, 2026 at 10:00 AM.",
    );
    expect(approved.text).toContain("See you at the studio!");

    const declined = decisionEmail(booking, offer, "declined");
    expect(declined.subject).toBe("Your booking request at TUMACH");
    expect(declined.text).toContain(
      "Sorry, Nina cannot take your request: Private lesson, 60 min, Sunday, October 25, 2026 at 10:00 AM.",
    );
    expect(declined.text).toContain("You can pick another time on the booking page.");
  });

  test("Dutch: the language of the booking", () => {
    const { booking, offer } = booked("nl");
    const approved = decisionEmail(booking, offer, "approved");
    expect(approved.subject).toBe("Je boeking bij TUMACH is bevestigd");
    expect(approved.text).toContain("Hoi Ana,");
    expect(approved.text).toContain(
      "Nina heeft je aanvraag goedgekeurd: Privéles, 60 min, zondag 25 oktober 2026 om 10:00.",
    );
    const declined = decisionEmail(booking, offer, "declined");
    expect(declined.subject).toBe("Je aanvraag bij TUMACH");
    expect(declined.text).toContain(
      "Sorry, Nina kan je aanvraag niet aannemen: Privéles, 60 min, zondag 25 oktober 2026 om 10:00.",
    );
  });
});

describe("the requests page sends the email", () => {
  let dir: string;
  const saved = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "decision-email-"));
    process.env.EMAIL_LOG_FILE = join(dir, "mail.jsonl");
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  function tap(id: number, decision: string) {
    const form = new FormData();
    form.set("id", String(id));
    form.set("decision", decision);
    return decide(form);
  }

  const sent = () =>
    readFileSync(process.env.EMAIL_LOG_FILE as string, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));

  test("an approve sends the approval email through the log transport, once", async () => {
    const { db, booking } = booked("nl");
    state.db = db;
    await expect(tap(booking.id, "approved")).rejects.toThrow("redirect /studio/bookings?done=approved");
    // A second tap finds the request already decided: no second email.
    await expect(tap(booking.id, "approved")).rejects.toThrow("redirect /studio/bookings");

    expect(sent()).toHaveLength(1);
    expect(sent()[0]).toMatchObject({ to: "ana@example.com", subject: "Je boeking bij TUMACH is bevestigd" });
  });

  test("a decline sends the decline email", async () => {
    const { db, booking } = booked("en");
    state.db = db;
    await expect(tap(booking.id, "declined")).rejects.toThrow("redirect /studio/bookings?done=declined");

    expect(sent()).toHaveLength(1);
    expect(sent()[0].text).toContain("Sorry, Nina cannot take your request");
  });

  test("a failed email keeps the decision: the error is logged", async () => {
    const { db, booking } = booked("en");
    state.db = db;
    // Production with no Mailgun key: the email transport throws.
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EMAIL_LOG_FILE;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(tap(booking.id, "approved")).rejects.toThrow("redirect /studio/bookings?done=approved");

    expect(error).toHaveBeenCalled();
    const row = db.select().from(bookings).where(eq(bookings.id, booking.id)).get();
    expect(row?.status).toBe("approved");
  });
});
