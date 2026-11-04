// The repeat email names the move next to the cancel link of each date and at the end (#646, #809), in English and Dutch.
import { DateTime } from "luxon";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { decideBooking, requestBooking } from "../src/db/bookings";
import { addOffer } from "../src/db/offers";
import { offers as offersTable } from "../src/db/schema";
import { cancelUrl } from "../src/lib/booking-cancel";
import { repeatEmail } from "../src/lib/booking-email";
import { repeatBooking } from "../src/lib/booking-repeat";
import { saveHoursRule } from "../src/lib/hours-store";

vi.mock("../src/lib/email", () => ({ sendEmail: vi.fn(async () => {}) }));

const zone = "Europe/Amsterdam";
const NOW = DateTime.fromISO("2026-10-20T12:00", { zone }).toMillis();
const HOUR = 60 * 60_000;

let db: Db;

beforeEach(() => {
  db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "17:00" } } });
  addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 });
});

/** An approved lesson on Sunday 25 October at 10:00, then the repeat of 4 weeks: the new bookings. */
function repeated(locale = "en") {
  const start = DateTime.fromISO("2026-10-25T10:00", { zone }).toMillis();
  const offerId = (db.select().from(offersTable).get() as { id: number }).id;
  const result = requestBooking(
    db,
    { offerId, start, end: start + HOUR, name: "Ana", email: "ana@example.com", phone: "+31 6 12345678", locale },
    { now: NOW },
  );
  if (!result.ok) throw new Error(`the booking should be ok: ${result.reason}`);
  const decided = decideBooking(db, result.booking.id, "approved", null, NOW);
  if (!decided.ok) throw new Error(`the approval should be ok: ${decided.reason}`);
  const repeat = repeatBooking(db, decided.booking.id, 4, { now: NOW });
  if (!repeat.ok) throw new Error(`the repeat should be ok: ${repeat.reason}`);
  return repeat.added;
}

function offer() {
  return db.select().from(offersTable).get() as Parameters<typeof repeatEmail>[1];
}

describe("repeat email names the move (#646)", () => {
  test("each date line names the move and the cancel, in English", () => {
    const added = repeated("en");
    const text = repeatEmail(added, offer(), "https://tumach.dance").text ?? "";
    for (const b of added) expect(text).toContain(`move or cancel with ${cancelUrl("https://tumach.dance", b)}`);
    expect(text.match(/move or cancel with https:\/\/tumach\.dance\/en\/booking\/cancel/g)).toHaveLength(added.length);
  });

  test("the end line names the move, in English", () => {
    const added = repeated("en");
    const text = repeatEmail(added, offer(), "https://tumach.dance").text ?? "";
    expect(text).toContain(
      "Another time, or can you not come on one of these dates? Move or cancel that booking with its link, at any time before the start.",
    );
  });

  test("each date line and the end line name the move, in Dutch", () => {
    const added = repeated("nl");
    const text = repeatEmail(added, offer(), "https://tumach.dance").text ?? "";
    expect(text.match(/verplaatsen of annuleren met https:\/\/tumach\.dance\/nl\/booking\/cancel/g)).toHaveLength(
      added.length,
    );
    expect(text).toContain(
      "Een andere tijd, of kun je op een van deze data niet komen? Verplaats of annuleer die boeking met de link, op elk moment voor de start.",
    );
  });
});
