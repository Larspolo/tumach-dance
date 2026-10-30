// How soon before a time a dancer can book it (#35): the one place to change it. Owner's answer: no limit, 0 hours.
export const BOOKING_NOTICE_HOURS = 0;

/** The first instant that the booking page shows, for `now`. */
export function notBefore(now: number): number {
  return now + BOOKING_NOTICE_HOURS * 3_600_000;
}
