// The email to a dancer after a booking request (#37): the language of the page, the Amsterdam time, and the log transport.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DateTime } from "luxon";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { listOpenRequests, requestBooking } from "../src/db/bookings";
import { addOffer, listOffers } from "../src/db/offers";
import { requestEmail, sendRequestEmail } from "../src/lib/booking-email";
import { saveHoursRule } from "../src/lib/hours-store";

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
// Sunday 2026-10-25: the day that summer time ends. 10:00 local is 10:00 CET (09:00 UTC).
const START = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();

function booked() {
  const db = openDb(":memory:");
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
      locale: "nl",
    },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  return { booking: result.booking, offer };
}

describe("requestEmail", () => {
  test("English: the offer, the Amsterdam time and that Nina answers soon", () => {
    const { booking, offer } = booked();
    const email = requestEmail(booking, offer, "en");
    expect(email.to).toBe("ana@example.com");
    expect(email.subject).toBe("Your booking request at TUMACH");
    expect(email.text).toContain("Hi Ana,");
    expect(email.text).toContain(
      "Thank you for your request: Private lesson, 60 min, Sunday, October 25, 2026 at 10:00 AM.",
    );
    expect(email.text).toContain("Nina will look at it and answer you soon.");
  });

  test("Dutch: the subject and the text in Dutch", () => {
    const { booking, offer } = booked();
    const email = requestEmail(booking, offer, "nl");
    expect(email.subject).toBe("Je aanvraag bij TUMACH");
    expect(email.text).toContain("Hoi Ana,");
    expect(email.text).toContain("Bedankt voor je aanvraag: Privéles, 60 min, zondag 25 oktober 2026 om 10:00.");
    expect(email.text).toContain("Nina kijkt ernaar en antwoordt je snel.");
  });

  test("an old Slovenian booking (#299): the text in English", () => {
    const { booking, offer } = booked();
    expect(requestEmail(booking, offer, "sl").subject).toBe(requestEmail(booking, offer, "en").subject);
  });
});

describe("sendRequestEmail", () => {
  let dir: string;
  const saved = { ...process.env };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "booking-email-"));
    process.env.EMAIL_LOG_FILE = join(dir, "mail.jsonl");
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
  });

  afterEach(() => {
    process.env = { ...saved };
    rmSync(dir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  test("a booking request sends the email through the log transport", async () => {
    const db = openDb(":memory:");
    saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "13:00" } } });
    const offer = addOffer(db, { kind: "rental", minutes: 120, priceCents: 9000, position: 0 });
    const result = requestBooking(
      db,
      {
        offerId: offer.id,
        start: START,
        end: START + 120 * 60_000,
        name: "Ana",
        email: "ana@example.com",
        phone: "+31612345678",
        locale: "nl",
      },
      { now: NOW },
    );
    if (!result.ok) throw new Error("the booking should be ok");
    vi.spyOn(console, "info").mockImplementation(() => {});

    await sendRequestEmail(db, result.booking, "nl");

    const sent = readFileSync(process.env.EMAIL_LOG_FILE as string, "utf8")
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "ana@example.com", subject: "Je aanvraag bij TUMACH" });
    expect(sent[0].text).toContain("Studio huren, 120 min");
  });

  test("a failed email does not undo the booking: the error is logged", async () => {
    const db = openDb(":memory:");
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
        phone: "+31612345678",
        locale: "en",
      },
      { now: NOW },
    );
    if (!result.ok) throw new Error("the booking should be ok");
    // Production with no Mailgun key: the email transport throws.
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.EMAIL_LOG_FILE;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(sendRequestEmail(db, result.booking, "en")).resolves.toBeUndefined();

    expect(error).toHaveBeenCalled();
    expect(listOpenRequests(db)).toHaveLength(1);
    expect(listOffers(db)).toHaveLength(1);
  });
});
