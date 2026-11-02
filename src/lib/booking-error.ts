import type { BookingResult } from "@/db/bookings";

/**
 * The `error` of the booking page for a refused request (#402): a note that is too long has its own message. `limit`:
 * the limit of the connection (#374); `limitOpen` and `limitDay`: the limits of `bookingLimit()` (#541); `check`: the Turnstile check failed (#564).
 */
export const BOOKING_ERRORS = [
  "taken",
  "invalid",
  "notSlot",
  "limit",
  "limitOpen",
  "limitDay",
  "noteLong",
  "check",
] as const;
export type BookingError = (typeof BOOKING_ERRORS)[number];

export function bookingError(result: Extract<BookingResult, { ok: false }>): BookingError {
  if (result.reason === "invalid" && result.field === "note") return "noteLong";
  if (result.reason === "limit") return result.limit === "open" ? "limitOpen" : "limitDay";
  return result.reason;
}
