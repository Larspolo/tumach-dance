// Stop spam bots on the contact form with no puzzle (#151): a honeypot field, a signed time of the page, and a limit
// per address. A bot gets the normal answer and learns nothing; no email goes out.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { HONEYPOT, STAMP } from "./contact-fields";

export const MIN_MS = 3000;
const MAX_MS = 24 * 60 * 60 * 1000;
const PER_HOUR = 5;

// With no secret (development), a key of this process: one server process, so a stamp of it stays valid.
const fallback = randomBytes(32).toString("hex");
const sign = (time: string) =>
  createHmac("sha256", process.env.BETTER_AUTH_SECRET || fallback)
    .update(`contact:${time}`)
    .digest("hex");

/** The value of the stamp field for a page made at `now`. */
export function contactStamp(now = Date.now()): string {
  return `${now}.${sign(String(now))}`;
}

// In memory: one server process on the home server.
let limiter = new RateLimiterMemory({ points: PER_HOUR, duration: 60 * 60 });

/** Start the limit again (tests). */
export function resetContactLimit() {
  limiter = new RateLimiterMemory({ points: PER_HOUR, duration: 60 * 60 });
}

/** The address of the visitor: the header of Cloudflare, else the first address of `x-forwarded-for`. */
export function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip") || headers.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
}

/** Why the send looks like a bot, or null for a person. Each person send counts toward the limit of the address. */
export async function spamReason(
  form: FormData,
  address: string,
  { now = Date.now(), minMs = MIN_MS } = {},
): Promise<string | null> {
  if (String(form.get(HONEYPOT) ?? "") !== "") return "honeypot";
  const [time, signature = ""] = String(form.get(STAMP) ?? "").split(".");
  const expected = Buffer.from(sign(time));
  const given = Buffer.from(signature);
  if (!/^\d+$/.test(time) || given.length !== expected.length || !timingSafeEqual(given, expected)) return "stamp";
  const age = now - Number(time);
  if (age < minMs) return "too fast";
  if (age > MAX_MS) return "too old";
  try {
    await limiter.consume(address);
  } catch {
    return "limit";
  }
  return null;
}
