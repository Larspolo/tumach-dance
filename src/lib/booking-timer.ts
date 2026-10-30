// The timer of the booking emails (#165): `src/instrumentation.ts` starts it at each start of the server, also with
// no `GITHUB_TOKEN`. It checks now and every 5 minutes: the reminder the day before, and the payment reminder (#167).
import type { Db } from "../db";
import { checkReminders } from "./booking-reminder";
import { checkPaymentReminders } from "./payment-reminder";

export const BOOKING_CHECK_INTERVAL_MS = 5 * 60_000;

const timer = globalThis as unknown as { tumachBookingTimer?: NodeJS.Timeout };

/**
 * Start the checks of the booking emails, once per process. An error is logged once (not each 5 minutes until it is
 * fixed); the next check tries again and the timer never stops the server.
 */
export function startBookingTimer(db: Db): NodeJS.Timeout {
  if (timer.tumachBookingTimer) return timer.tumachBookingTimer;
  let failing = false;
  const check = () =>
    Promise.all([checkReminders(db), checkPaymentReminders(db)]).then(
      () => {
        failing = false;
      },
      (error) => {
        if (!failing) console.error("booking reminder check failed", error);
        failing = true;
      },
    );
  void check();
  timer.tumachBookingTimer = setInterval(check, BOOKING_CHECK_INTERVAL_MS);
  timer.tumachBookingTimer.unref();
  return timer.tumachBookingTimer;
}
