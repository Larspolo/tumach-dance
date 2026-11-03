// Push notifications to the phone of Nina (#25): the Push API of the browser and `web-push` with the VAPID keys of
// the `.env`. Later features (new bookings, questions) send with `sendPush`.
import { and, eq, gt } from "drizzle-orm";
import { hasLocale } from "next-intl";
import webpush from "web-push";
import type { Db } from "../db";
import { pushSubscriptions, session } from "../db/schema";
import { routing } from "../i18n/routing";

export type PushMessage = { title: string; body: string; url?: string };
export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };
export type PushLocale = (typeof routing.locales)[number];

/** The public VAPID key for the browser, or undefined when the server has no keys. */
export function vapidPublicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY || undefined;
}

function configure(): boolean {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY || !VAPID_SUBJECT) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return true;
}

export function isSubscription(value: unknown): value is Subscription {
  const v = value as Subscription | null;
  return (
    typeof v?.endpoint === "string" &&
    /^https:\/\//.test(v.endpoint) &&
    typeof v.keys?.p256dh === "string" &&
    typeof v.keys?.auth === "string"
  );
}

/** Store a device with the language of its studio app. The same endpoint replaces its old row. */
export function saveSubscription(
  db: Db,
  sub: Subscription,
  now = Date.now(),
  locale: PushLocale = routing.defaultLocale,
  sessionId: string | null = null,
): void {
  // The login of the device (#586): its end deletes the push (`ON DELETE CASCADE`).
  const row = {
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    createdAt: now,
    locale,
    sessionId,
  };
  db.insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row }).run();
}

/**
 * True when the server has the push of this device for the login of the request (#570, #605): the studio app makes a
 * new push when not. A row with no session or of an old session gives false.
 */
export function hasSubscription(db: Db, endpoint: string, sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  const row = db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.sessionId, sessionId)))
    .get();
  return row !== undefined;
}

/**
 * Send to each device. A function gives the message in the language of each device (a timer has no request, #69).
 * A device that answers 404 or 410 is gone: delete it. Gives the count of sent pushes.
 */
export async function sendPush(db: Db, message: PushMessage | ((locale: PushLocale) => PushMessage)): Promise<number> {
  if (!configure()) throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are not set");
  // Only a device with a live login (#605): no push to a row with no session or with an expired session.
  const rows = db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
      locale: pushSubscriptions.locale,
    })
    .from(pushSubscriptions)
    .innerJoin(session, eq(pushSubscriptions.sessionId, session.id))
    .where(gt(session.expiresAt, new Date()))
    .all();
  let sent = 0;
  for (const row of rows) {
    const locale = hasLocale(routing.locales, row.locale) ? row.locale : routing.defaultLocale;
    const payload = JSON.stringify(typeof message === "function" ? message(locale) : message);
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload);
      sent++;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, row.endpoint)).run();
      } else {
        console.error("push failed", status, error);
      }
    }
  }
  return sent;
}
