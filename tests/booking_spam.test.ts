// The bot check of the booking form (#374): a bot gets "request sent" and makes no booking, no email and no push; a
// person over the limit of the address gets error=limit; the contact form and the booking form count apart.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { saveHoursRule } from "../src/lib/hours-store";

const calls = vi.hoisted(() => ({ email: vi.fn(), push: vi.fn() }));
const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("../src/db", async (orig) => ({ ...(await orig<object>()), getDb: () => state.db }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`redirect ${url}`);
  },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "cf-connecting-ip": "203.0.113.7" }) }));
vi.mock("../src/lib/booking-email", () => ({ sendRequestEmail: calls.email }));
vi.mock("../src/lib/booking-push", () => ({ sendRequestPush: calls.push }));

const { sendRequest } = await import("../src/app/[locale]/book/actions");
const { contactStamp, formStamp, resetContactLimit, spamReason } = await import("../src/lib/contact-spam");
const { listOpenRequests } = await import("../src/db/bookings");

// Monday 2026-11-02 10:00 Amsterdam; the request is for Sunday 2026-11-08 10:00.
const NOW = Date.UTC(2026, 10, 2, 9);
const START = Date.UTC(2026, 10, 8, 9);
let offerId = 0;

function form(stamp: string, extra: Record<string, string> = {}) {
  const f = new FormData();
  const fields = {
    locale: "en",
    offerId: String(offerId),
    start: String(START),
    end: String(START + 60 * 60_000),
    name: "Ana",
    email: "ana@example.com",
    phone: "+31 6 12345678",
    day: "2026-11-08",
    stamp,
    ...extra,
  };
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

const person = () => formStamp("booking", Date.now() - 5000);
const open = () => listOpenRequests(state.db as never).length;

beforeEach(() => {
  vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  const db = openDb(":memory:");
  saveHoursRule(db, { weekly: { sun: { from: "09:00", to: "21:00" } } });
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
  state.db = db;
  calls.email.mockReset();
  calls.push.mockReset();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetContactLimit();
});

describe("a bot", () => {
  test.each([
    ["a filled honeypot", () => form(person(), { website: "http://spam.example" })],
    ["a wrong stamp", () => form(`${Date.now() - 5000}.abc`)],
    ["a stamp of the contact form", () => form(contactStamp(Date.now() - 5000))],
    ["a send under the minimum time", () => form(formStamp("booking", Date.now() - 500))],
  ])("%s makes no booking, no email, no push and sees request sent", async (_name, make) => {
    await expect(sendRequest(make())).rejects.toThrow("redirect /en/book?sent=1");
    expect(open()).toBe(0);
    expect(calls.email).not.toHaveBeenCalled();
    expect(calls.push).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("spam"));
  });
});

describe("the limit per address", () => {
  test("the request after 10 in an hour gets error=limit and makes no booking", async () => {
    for (let i = 0; i < 10; i++) {
      // Each request takes the same time: a person who gets "taken" still counts.
      await expect(sendRequest(form(person()))).rejects.toThrow(/sent=1|error=taken/);
    }
    expect(open()).toBe(1);
    await expect(sendRequest(form(person()))).rejects.toThrow("error=limit");
    expect(open()).toBe(1);
  });

  test("the contact limit and the booking limit count apart", async () => {
    const contact = new FormData();
    for (let i = 0; i < 5; i++) {
      contact.set("stamp", contactStamp(Date.now() - 5000));
      expect(await spamReason(contact, "203.0.113.7")).toBeNull();
    }
    expect(await spamReason(contact, "203.0.113.7")).toBe("limit");
    await expect(sendRequest(form(person()))).rejects.toThrow("sent=1");
    expect(open()).toBe(1);
  });

  test("a bot send does not count toward the limit", async () => {
    for (let i = 0; i < 20; i++) {
      await expect(sendRequest(form(person(), { website: "x" }))).rejects.toThrow("sent=1");
    }
    await expect(sendRequest(form(person()))).rejects.toThrow("sent=1");
    expect(open()).toBe(1);
  });
});
