// The push to Nina when the booking page stops the requests of the day (#541, the day limit of `booking-limits.ts`).
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json" with { type: "json" };
import nl from "../../messages/nl.json" with { type: "json" };
import type { Db } from "../db";
import { settings } from "../db/schema";
import { withFallback } from "../i18n/fallback";
import { DAY_MS } from "./booking-limits";
import { type PushLocale, type PushMessage, sendPush } from "./push";

const KEY = "bookingLimitPushAt";
const MESSAGES = { en, nl: withFallback(nl, en) };

/** The push to Nina when the site stops the requests of the day, in the language `locale` of her studio app. */
export function limitPush(locale: PushLocale): PushMessage {
  const t = createTranslator({ locale, messages: MESSAGES[locale] });
  return { title: t("bookingPush.limitTitle"), body: t("bookingPush.limitBody"), url: "/studio/bookings" };
}

/**
 * Tell Nina that the site stops the requests of the day: at most one push in 24 hours. The time of the push is in
 * `settings` before the send, so that a second request at the same moment or a restart gives no second push. A failed
 * push is logged. Gives true when it sent the push.
 */
export async function sendLimitPush(db: Db, now = Date.now()): Promise<boolean> {
  const row = db.select().from(settings).where(eq(settings.key, KEY)).get();
  if (row && now - Number(JSON.parse(row.value)) < DAY_MS) return false;
  const value = JSON.stringify(now);
  db.insert(settings)
    .values({ key: KEY, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
  try {
    await sendPush(db, limitPush);
  } catch (error) {
    console.error("[booking-limits] the push of the day limit failed:", error);
  }
  return true;
}
