// The push to Nina when an email to a dancer bounces (#494). Mailgun accepts the email, then the server of the dancer
// refuses it (the address does not exist): `sendEmail()` sees no error. The booking timer reads the permanent
// failures of the Mailgun Events API each 15 minutes and gives Nina one push per booking of that address.
// The state is one row of `settings` (no new table): the start, the last poll, the events that it read and the bookings
// that got a push. So a second poll and a restart give no second push, and the first poll reads no old events.
import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db";
import { bookings, settings } from "../db/schema";
import { sendEmailFailPush } from "./booking-push";
import { emailTransport } from "./email";
import { recordError } from "./site-errors";

export const BOUNCE_CHECK_INTERVAL_MS = 15 * 60_000;

/**
 * Mailgun can store an event some minutes after its time: each poll reads again from 30 minutes before the last poll,
 * and the kept ids skip the events that it read before.
 */
export const EVENT_LAG_S = 30 * 60;

/** The most pages of one poll (300 events each): a safe end for a wrong `paging.next`. */
const MAX_PAGES = 20;

const KEY = "emailBounces";

/** All times are Mailgun timestamps: epoch seconds (with a fraction), UTC. `pushed`: booking id → its end (ms). */
export type BounceState = {
  start: number;
  polledAt: number;
  seen: Record<string, number>;
  pushed: Record<string, number>;
};

type MailgunEvent = { id: string; recipient: string; timestamp: number };
type EventPage = { items?: MailgunEvent[]; paging?: { next?: string } };

export function getBounceState(db: Db): BounceState | undefined {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  return row ? (JSON.parse(row.value) as BounceState) : undefined;
}

function saveBounceState(db: Db, state: BounceState, now: number): void {
  const row = { key: KEY, value: JSON.stringify(state), updatedAt: now };
  db.insert(settings)
    .values(row)
    .onConflictDoUpdate({ target: settings.key, set: { value: row.value, updatedAt: row.updatedAt } })
    .run();
}

/** The permanent failures from `begin` (epoch seconds), all pages, the oldest first. */
async function readFailures(env: NodeJS.ProcessEnv, begin: number, fetchFn: typeof fetch): Promise<MailgunEvent[]> {
  const domain = env.MAILGUN_DOMAIN as string;
  const query = new URLSearchParams({
    event: "failed",
    severity: "permanent",
    begin: String(begin),
    ascending: "yes",
    limit: "300",
  });
  let url: string | undefined = `${env.MAILGUN_API_URL || "https://api.mailgun.net"}/v3/${domain}/events?${query}`;
  const headers = { Authorization: `Basic ${Buffer.from(`api:${env.MAILGUN_API_KEY}`).toString("base64")}` };
  const events: MailgunEvent[] = [];
  for (let page = 0; url && page < MAX_PAGES; page++) {
    const response = await fetchFn(url, { headers });
    if (!response.ok) {
      const reason = (await response.text().catch(() => "")).replace(/\s+/g, " ").trim().slice(0, 200);
      throw new Error(`Email bounces: Mailgun answered ${response.status}${reason ? `: ${reason}` : ""}`);
    }
    const body = (await response.json()) as EventPage;
    const items = body.items ?? [];
    if (items.length === 0) break;
    events.push(...items);
    url = body.paging?.next;
  }
  return events;
}

/**
 * Read the new bounces and push Nina once for each booking of a bounced address that has not ended. Only with the
 * transport `mailgun`. An error of the API is logged and kept for `/api/health`; it never throws, and the next poll
 * reads the same time again. Gives the ids of the bookings that got a push.
 */
export async function checkBounces(
  db: Db,
  {
    now = Date.now(),
    env = process.env,
    fetchFn = fetch,
  }: { now?: number; env?: NodeJS.ProcessEnv; fetchFn?: typeof fetch } = {},
): Promise<number[]> {
  let transport: "mailgun" | "log";
  try {
    transport = emailTransport(env);
  } catch {
    return [];
  }
  if (transport !== "mailgun") return [];
  const nowS = now / 1000;
  const state = getBounceState(db);
  if (!state) {
    saveBounceState(db, { start: nowS, polledAt: nowS, seen: {}, pushed: {} }, now);
    return [];
  }
  const begin = Math.max(state.start, state.polledAt - EVENT_LAG_S);
  let events: MailgunEvent[];
  try {
    events = await readFailures(env, begin, fetchFn);
  } catch (error) {
    console.error("[email-bounce] the bounce check failed", error);
    recordError("email: bounce check", error);
    return [];
  }
  const seen: Record<string, number> = {};
  for (const [id, at] of Object.entries(state.seen)) if (at >= begin) seen[id] = at;
  const pushed: Record<string, number> = {};
  for (const [id, end] of Object.entries(state.pushed)) if (end > now) pushed[id] = end;
  const toPush: (typeof bookings.$inferSelect)[] = [];
  for (const event of events) {
    if (event.id in seen) continue;
    seen[event.id] = event.timestamp;
    const rows = db
      .select()
      .from(bookings)
      .where(
        and(
          sql`lower(${bookings.email}) = ${event.recipient.trim().toLowerCase()}`,
          ne(bookings.status, "cancelled"),
          gt(bookings.end, now),
          isNull(bookings.forgottenAt),
        ),
      )
      .all();
    for (const booking of rows) {
      if (String(booking.id) in pushed) continue;
      pushed[booking.id] = booking.end;
      toPush.push(booking);
    }
  }
  // Save before the pushes: a crash after the save gives no second push.
  saveBounceState(db, { start: state.start, polledAt: nowS, seen, pushed }, now);
  for (const booking of toPush) await sendEmailFailPush(db, booking, "bounce");
  return toPush.map((b) => b.id);
}
