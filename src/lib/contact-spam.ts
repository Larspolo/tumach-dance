// Stop spam bots on the contact form (#151) and the booking form (#374) with no puzzle: a honeypot field, a signed time of the page, and a limit
// per address. A bot gets the normal answer and learns nothing; no email goes out.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { HONEYPOT, STAMP } from "./contact-fields";

export const MIN_MS = 3000;
const MAX_MS = 24 * 60 * 60 * 1000;

/** A form with its own stamp and its own limit per address. */
export type SpamScope = "contact" | "booking";

const envNumber = (name: string, fallback: number) => {
  const raw = process.env[name];
  return raw && Number.isFinite(Number(raw)) ? Number(raw) : fallback;
};
// The browser tests send many bookings fast from one address: they set lower or higher values (`playwright.config.ts`).
const perHour = (scope: SpamScope) => (scope === "contact" ? 5 : envNumber("BOOKING_LIMIT_PER_HOUR", 10));
const minMsOf = (scope: SpamScope) => (scope === "contact" ? MIN_MS : envNumber("BOOKING_MIN_MS", MIN_MS));

// With no secret (development), a key of this process: one server process, so a stamp of it stays valid.
const fallback = randomBytes(32).toString("hex");
const sign = (scope: SpamScope, time: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET || fallback)
    .update(`${scope}:${time}`)
    .digest("hex");

/** The value of the stamp field of the form `scope` for a page made at `now`. */
export function formStamp(scope: SpamScope, now = Date.now()): string {
  return `${now}.${sign(scope, String(now))}`;
}

/** The value of the stamp field of the contact form for a page made at `now`. */
export function contactStamp(now = Date.now()): string {
  return formStamp("contact", now);
}

// In memory: one server process on the home server. One limiter per form.
const newLimiter = (scope: SpamScope) => new RateLimiterMemory({ points: perHour(scope), duration: 60 * 60 });
const limiters = new Map<SpamScope, RateLimiterMemory>();
const limiterOf = (scope: SpamScope) => {
  let limiter = limiters.get(scope);
  if (!limiter) {
    limiter = newLimiter(scope);
    limiters.set(scope, limiter);
  }
  return limiter;
};

/** Start the limits of all forms again (tests). */
export function resetContactLimit() {
  limiters.clear();
}

/** The address of the visitor: the header of Cloudflare, else the first address of `x-forwarded-for`. */
export function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Why the contact send looks like a bot, or null for a person. */
export function spamReason(form: FormData, address: string, options: { now?: number; minMs?: number } = {}) {
  return formSpamReason("contact", form, address, options);
}

/**
 * Why the send of the form `scope` looks like a bot, or null for a person. Each send that passes the honeypot and
 * the stamp counts toward the limit of the address for that form.
 */
export async function formSpamReason(
  scope: SpamScope,
  form: FormData,
  address: string,
  { now = Date.now(), minMs = minMsOf(scope) }: { now?: number; minMs?: number } = {},
): Promise<string | null> {
  if (String(form.get(HONEYPOT) ?? "") !== "") return "honeypot";
  const [time, signature = ""] = String(form.get(STAMP) ?? "").split(".");
  const expected = Buffer.from(sign(scope, time));
  const given = Buffer.from(signature);
  if (!/^\d+$/.test(time) || given.length !== expected.length || !timingSafeEqual(given, expected)) return "stamp";
  const age = now - Number(time);
  if (age < minMs) return "too fast";
  if (age > MAX_MS) return "too old";
  try {
    await limiterOf(scope).consume(address);
  } catch {
    return "limit";
  }
  return null;
}
