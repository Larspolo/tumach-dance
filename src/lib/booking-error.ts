import type { BookingResult } from "@/db/bookings";

/** The `error` of the booking page for a refused request (#402): a note that is too long has its own message. */
export const BOOKING_ERRORS = ["taken", "invalid", "notSlot", "limit", "noteLong"] as const;
export type BookingError = (typeof BOOKING_ERRORS)[number];

export function bookingError(result: Extract<BookingResult, { ok: false }>): BookingError {
  if (result.reason === "invalid" && result.field === "note") return "noteLong";
  return result.reason;
}
