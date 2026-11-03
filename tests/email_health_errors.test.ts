// A failed email of the site shows in `/api/health` `errors` (#460), so that a run finds why an email did not go out
// with no server log (#306, #424): one error per kind (`email: <kind>`), with the reason of Mailgun and no address or
// phone number of a dancer.
import { DateTime } from "luxon";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { type Db, getDb, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import { clearErrors, siteErrors } from "../src/lib/site-errors";

const REASON = "Email: Mailgun answered 400: 'to' parameter is not a valid address: ana@example.com, +31 6 1234 5678";
const mail = vi.hoisted(() => ({ fail: false }));
vi.mock("../src/lib/email", async (orig) => ({
  ...(await orig<object>()),
  sendEmail: vi.fn(async () => {
    if (mail.fail) throw new Error(REASON);
  }),
}));
vi.mock("../src/lib/push", async (orig) => ({ ...(await orig<object>()), sendPush: vi.fn() }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { sendCancelEmail, sendDecisionEmail, sendMoveEmail, sendRequestEmail } = await import(
  "../src/lib/booking-email"
);
const { checkReminders } = await import("../src/lib/booking-reminder");
const { checkUnanswered } = await import("../src/lib/booking-unanswered");
const { checkPaymentReminders } = await import("../src/lib/payment-reminder");
const { sendContact } = await import("../src/app/[locale]/contact-action");
const { contactStamp, resetContactLimit } = await import("../src/lib/contact-spam");
const { GET } = await import("../src/app/api/health/route");

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
let db: Db;
let offerId: number;

beforeEach(() => {
  mail.fail = true;
  clearErrors();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  vi.mocked(getDb).mockReturnValue(db);
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
  process.env.STUDIO_EMAIL = "nina@example.com";
});

afterEach(() => {
  vi.restoreAllMocks();
  resetContactLimit();
  delete process.env.STUDIO_EMAIL;
  clearErrors();
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
      email: "ana@example.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: at(start) - 7 * 24 * HOUR,
      ...change,
    })
    .returning()
    .get();
}

/** The kept error of `where`; it fails when there is none, or when it has the address or the phone of the dancer. */
function errorOf(where: string) {
  const error = siteErrors().find((e) => e.where === where);
  expect(error, where).toBeDefined();
  expect(error?.message).toContain("Mailgun answered 400");
  expect(error?.message).not.toContain("ana@example.com");
  expect(error?.message).not.toContain("1234");
  return error;
}

test("a failed email of a booking (request, decision, cancel, move) is an error of its kind", async () => {
  const booking = book("2026-11-20T10:00");
  await sendRequestEmail(db, booking, "nl");
  await sendDecisionEmail(db, booking, "approved");
  await sendCancelEmail(db, booking);
  await sendMoveEmail(db, booking, { start: booking.start - HOUR, end: booking.start });
  for (const kind of ["request", "decision", "cancel", "move"]) errorOf(`email: ${kind}`);
});

test("a failed reminder, payment reminder and unanswered email are errors of their kind", async () => {
  book("2026-11-20T10:00", { approvedAt: at("2026-11-13T10:00") });
  book("2026-11-04T10:00", { status: "requested", createdAt: at("2026-11-02T10:00") });
  await expect(checkReminders(db, at("2026-11-19T12:00"))).rejects.toThrow();
  await expect(checkPaymentReminders(db, at("2026-11-19T12:00"))).rejects.toThrow();
  await checkUnanswered(db, at("2026-11-04T10:30"));
  for (const kind of ["reminder", "payment", "unanswered"]) errorOf(`email: ${kind}`);
});

test("a failed contact message is an error, and /api/health shows it", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ name: "Ana", email: "ana@example.com", message: "Sunday?" })) {
    form.set(key, value);
  }
  form.set("stamp", contactStamp(Date.now() - 5000));
  const state = await sendContact({ status: "idle", errors: {}, values: { name: "", email: "", message: "" } }, form);
  expect(state.status).toBe("failed");
  errorOf("email: contact");
  const body = await (await GET()).json();
  expect(body.errors.map((e: { where: string }) => e.where)).toContain("email: contact");
  expect(JSON.stringify(body)).not.toContain("ana@example.com");
});

test("the error of Mailgun has its reason", async () => {
  const { sendEmail } = await vi.importActual<typeof import("../src/lib/email")>("../src/lib/email");
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('{"message":"Domain not found: mg.tumach.dance"}', { status: 404 }),
  );
  const env = {
    MAILGUN_API_KEY: "key",
    MAILGUN_DOMAIN: "mg.tumach.dance",
    NODE_ENV: "production",
  } as NodeJS.ProcessEnv;
  await expect(sendEmail({ to: "ana@example.com", subject: "Hi", text: "Hi" }, env)).rejects.toThrow(
    'Email: Mailgun answered 404: {"message":"Domain not found: mg.tumach.dance"}',
  );
});
