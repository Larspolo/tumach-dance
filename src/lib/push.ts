// Push notifications to the phone of Nina (#25): the Push API of the browser and `web-push` with the VAPID keys of
// the `.env`. Later features (new bookings, questions) send with `sendPush`.
import { eq } from "drizzle-orm";
import webpush from "web-push";
import type { Db } from "../db";
import { pushSubscriptions } from "../db/schema";

export type PushMessage = { title: string; body: string; url?: string };
export type Subscription = { endpoint: string; keys: { p256dh: string; auth: string } };

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

/** Store a device. The same endpoint replaces its old row. */
export function saveSubscription(db: Db, sub: Subscription, now = Date.now()): void {
  const row = { endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, createdAt: now };
  db.insert(pushSubscriptions).values(row).onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: row }).run();
}

/** Send to each device. A device that answers 404 or 410 is gone: delete it. Gives the count of sent pushes. */
export async function sendPush(db: Db, message: PushMessage): Promise<number> {
  if (!configure()) throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT are not set");
  const rows = db.select().from(pushSubscriptions).all();
  const payload = JSON.stringify(message);
  let sent = 0;
  for (const row of rows) {
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
