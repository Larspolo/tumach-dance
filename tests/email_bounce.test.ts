// The push to Nina when an email to a dancer bounces (#494): a fake Mailgun Events API. One push per booking that has
// not ended, also after a second poll and a restart; no push for an address with no coming booking; an error of the
// API is logged and the next poll works; the transport `log` reads no API.
import { DateTime } from "luxon";
import { beforeEach, expect, test, vi } from "vitest";
import { type Db, openDb } from "../src/db";
import { addOffer } from "../src/db/offers";
import { bookings } from "../src/db/schema";
import type { PushMessage } from "../src/lib/push";

const push = vi.hoisted(() => ({ sendPush: vi.fn() }));
vi.mock("../src/lib/push", () => push);

const { checkBounces, EVENT_LAG_S, getBounceState } = await import("../src/lib/email-bounce");
const { clearErrors, siteErrors } = await import("../src/lib/site-errors");

const ENV = {
  NODE_ENV: "production",
  MAILGUN_API_KEY: "key-test",
  MAILGUN_DOMAIN: "mg.tumach.dance",
  MAILGUN_API_URL: "https://api.eu.mailgun.net",
} as unknown as NodeJS.ProcessEnv;

const at = (local: string) => DateTime.fromISO(local, { zone: "Europe/Amsterdam" }).toMillis();
const HOUR = 60 * 60_000;
const MIN = 60_000;
const T0 = at("2026-11-02T12:00");

type Event = { id: string; recipient: string; timestamp: number };

/** A fake Events API: it gives the events from `begin`, in pages of `pageSize`, and keeps the URLs that it got. */
function fakeApi(events: Event[], pageSize = 300) {
  const urls: string[] = [];
  const fetchFn = vi.fn(async (input: string | URL | Request, _init?: RequestInit) => {
    const url = new URL(String(input));
    urls.push(url.toString());
    const begin = Number(url.searchParams.get("begin"));
    const offset = Number(url.searchParams.get("offset") ?? 0);
    const items = events.filter((e) => e.timestamp >= begin).slice(offset, offset + pageSize);
    const next = new URL(url);
    next.searchParams.set("offset", String(offset + pageSize));
    return Response.json({ items, paging: { next: next.toString() } });
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, urls, mock: fetchFn };
}

let db: Db;
let offerId: number;

beforeEach(() => {
  push.sendPush.mockReset();
  clearErrors();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = openDb(":memory:");
  offerId = addOffer(db, { kind: "lesson", minutes: 60, priceCents: 6000, position: 0 }).id;
});

function book(start: number, change: Partial<typeof bookings.$inferInsert> = {}) {
  return db
    .insert(bookings)
    .values({
      offerId,
      start,
      end: start + HOUR,
      status: "requested",
      name: "Ana",
      email: "ana@exmple.com",
      phone: "+31 6 1234 5678",
      locale: "nl",
      createdAt: T0,
      ...change,
    })
    .returning()
    .get();
}

const bounce = (id: string, ms: number, recipient = "ana@exmple.com"): Event => ({
  id,
  recipient,
  timestamp: ms / 1000,
});

test("a bounce gives exactly one push with the name of the dancer, also after a second poll and a restart", async () => {
  const booking = book(at("2026-11-05T10:00"));
  const events: Event[] = [];
  const api = fakeApi(events);
  // The first poll keeps its time and reads no old events.
  expect(await checkBounces(db, { now: T0, env: ENV, fetchFn: api.fetchFn })).toEqual([]);
  expect(api.mock).not.toHaveBeenCalled();

  events.push(bounce("old", T0 - HOUR), bounce("b1", T0 + 2 * MIN, "Ana@Exmple.com "));
  expect(await checkBounces(db, { now: T0 + 15 * MIN, env: ENV, fetchFn: api.fetchFn })).toEqual([booking.id]);
  expect(push.sendPush).toHaveBeenCalledTimes(1);
  const make = push.sendPush.mock.calls[0][1] as (l: string) => PushMessage;
  expect(make("en").body).toContain("Ana");
  expect(make("en").body).toContain("bounced");
  expect(make("nl").body).toContain("Ana");
  expect(make("nl").url).toBe("/studio/week?start=2026-11-02");
  // The query of the ticket, at the EU address, from the start of the first poll.
  const first = new URL(api.urls[0]);
  expect(first.origin + first.pathname).toBe("https://api.eu.mailgun.net/v3/mg.tumach.dance/events");
  expect(first.searchParams.get("event")).toBe("failed");
  expect(first.searchParams.get("severity")).toBe("permanent");
  expect(first.searchParams.get("ascending")).toBe("yes");
  expect(Number(first.searchParams.get("begin"))).toBe(T0 / 1000);
  expect(api.mock.mock.calls[0][1]).toMatchObject({ headers: { Authorization: expect.stringMatching(/^Basic /) } });

  // A second poll reads the same event again (the lag window): no second push.
  expect(await checkBounces(db, { now: T0 + 30 * MIN, env: ENV, fetchFn: api.fetchFn })).toEqual([]);
  // A restart: the module keeps no state in memory, the next poll reads it from the database. A later email to the
  // address fails at once (`suppress-bounce`), a new event of the same booking: no second push either.
  events.push(bounce("b2", T0 + 40 * MIN));
  expect(getBounceState(db)?.seen).toHaveProperty("b1");
  expect(await checkBounces(db, { now: T0 + 45 * MIN, env: ENV, fetchFn: api.fetchFn })).toEqual([]);
  expect(push.sendPush).toHaveBeenCalledTimes(1);
});

test("each poll reads from the lag window before the last poll, never from before the first poll", async () => {
  const api = fakeApi([]);
  await checkBounces(db, { now: T0, env: ENV, fetchFn: api.fetchFn });
  await checkBounces(db, { now: T0 + 15 * MIN, env: ENV, fetchFn: api.fetchFn });
  await checkBounces(db, { now: T0 + 3 * HOUR, env: ENV, fetchFn: api.fetchFn });
  await checkBounces(db, { now: T0 + 3 * HOUR + 15 * MIN, env: ENV, fetchFn: api.fetchFn });
  // The poll of 12:00 only keeps its time; the lag window of 12:15 starts before 12:00, so the poll of 15:00 reads
  // from 12:00; a server that was off from 12:15 to 15:00 misses no event.
  expect(api.urls.map((u) => Number(new URL(u).searchParams.get("begin")))).toEqual([
    T0 / 1000,
    T0 / 1000,
    (T0 + 3 * HOUR) / 1000 - EVENT_LAG_S,
  ]);
});

test("all pages are read", async () => {
  book(at("2026-11-05T10:00"), { email: "a@x.nl", name: "Ana" });
  book(at("2026-11-05T12:00"), { email: "b@x.nl", name: "Bo" });
  const events: Event[] = [];
  const api = fakeApi(events, 1);
  await checkBounces(db, { now: T0, env: ENV, fetchFn: api.fetchFn });
  events.push(bounce("e1", T0 + MIN, "a@x.nl"), bounce("e2", T0 + 2 * MIN, "b@x.nl"));
  expect(await checkBounces(db, { now: T0 + 15 * MIN, env: ENV, fetchFn: api.fetchFn })).toHaveLength(2);
  expect(push.sendPush).toHaveBeenCalledTimes(2);
});

test("a bounce for an address with no coming booking gives no push", async () => {
  book(at("2026-11-01T10:00")); // ended
  book(at("2026-11-05T10:00"), { status: "cancelled" });
  book(at("2026-11-05T12:00"), { forgottenAt: T0 });
  const events: Event[] = [];
  const api = fakeApi(events);
  await checkBounces(db, { now: T0, env: ENV, fetchFn: api.fetchFn });
  events.push(bounce("e1", T0 + MIN), bounce("e2", T0 + MIN, "nobody@example.com"));
  expect(await checkBounces(db, { now: T0 + 15 * MIN, env: ENV, fetchFn: api.fetchFn })).toEqual([]);
  expect(push.sendPush).not.toHaveBeenCalled();
});

test("an error of the Events API is logged and kept for the health check, and the next poll works", async () => {
  const booking = book(at("2026-11-05T10:00"));
  const events: Event[] = [];
  const api = fakeApi(events);
  await checkBounces(db, { now: T0, env: ENV, fetchFn: api.fetchFn });
  events.push(bounce("b1", T0 + MIN));
  const down = vi.fn(async () => new Response("Forbidden", { status: 401 })) as unknown as typeof fetch;
  expect(await checkBounces(db, { now: T0 + 15 * MIN, env: ENV, fetchFn: down })).toEqual([]);
  expect(console.error).toHaveBeenCalled();
  expect(siteErrors()).toEqual([
    expect.objectContaining({ where: "email: bounce check", message: expect.stringContaining("401") }),
  ]);
  const offline = vi.fn(async () => {
    throw new TypeError("fetch failed");
  }) as unknown as typeof fetch;
  expect(await checkBounces(db, { now: T0 + 30 * MIN, env: ENV, fetchFn: offline })).toEqual([]);
  // The failed polls did not move the start of the next read: the bounce of 12:01 still gives its push.
  expect(await checkBounces(db, { now: T0 + 45 * MIN, env: ENV, fetchFn: api.fetchFn })).toEqual([booking.id]);
  expect(push.sendPush).toHaveBeenCalledTimes(1);
});

test("with the transport log, or with no keys, the check reads no API and keeps no state", async () => {
  const api = fakeApi([]);
  const log = { NODE_ENV: "development" } as unknown as NodeJS.ProcessEnv;
  const noKeys = { NODE_ENV: "production" } as unknown as NodeJS.ProcessEnv;
  for (const env of [log, noKeys]) {
    expect(await checkBounces(db, { now: T0, env, fetchFn: api.fetchFn })).toEqual([]);
    expect(await checkBounces(db, { now: T0 + 15 * MIN, env, fetchFn: api.fetchFn })).toEqual([]);
  }
  expect(api.mock).not.toHaveBeenCalled();
  expect(getBounceState(db)).toBeUndefined();
});
