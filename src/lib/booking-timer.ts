// The timer of the booking emails (#165): `src/instrumentation.ts` starts it at each start of the server, also with
// no `GITHUB_TOKEN`. It checks now and every 5 minutes: the reminder the day before, the payment reminder (#167), the end of an unanswered request (#340), the decision email after its undo time (#572), the extra push to Nina for a request that still waits (#594), and the removal
// of the personal data of old bookings (#224) and of old contact messages (#533). Each 15 minutes it reads the bounced emails of Mailgun (#494).
import type { Db } from "../db";
import { checkNudges } from "./booking-nudge";
import { forgetOldBookings } from "./booking-privacy";
import { checkReminders } from "./booking-reminder";
import { checkUnanswered } from "./booking-unanswered";
import { forgetOldMessages } from "./contact-store";
import { sendDueDecisionEmails } from "./decision-mail";
import { BOUNCE_CHECK_INTERVAL_MS, checkBounces } from "./email-bounce";
import { checkPaymentReminders } from "./payment-reminder";

export const BOOKING_CHECK_INTERVAL_MS = 5 * 60_000;

const timer = globalThis as unknown as { tumachBookingTimer?: NodeJS.Timeout; tumachBounceTimer?: NodeJS.Timeout };

/**
 * Start the checks of the booking emails, once per process. An error is logged once (not each 5 minutes until it is
 * fixed); the next check tries again and the timer never stops the server.
 */
export function startBookingTimer(db: Db): NodeJS.Timeout {
  if (timer.tumachBookingTimer) return timer.tumachBookingTimer;
  let failing = false;
  const check = () =>
    Promise.all([
      sendDueDecisionEmails(db),
      checkReminders(db),
      checkUnanswered(db),
      checkNudges(db),
      checkPaymentReminders(db),
      Promise.resolve().then(() => forgetOldBookings(db)),
      Promise.resolve().then(() => forgetOldMessages(db)),
    ]).then(
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
  // `checkBounces` logs the errors of the API itself; with the transport `log` it reads no API.
  const bounces = () => void checkBounces(db).catch((error) => console.error("bounce check failed", error));
  bounces();
  timer.tumachBounceTimer = setInterval(bounces, BOUNCE_CHECK_INTERVAL_MS);
  timer.tumachBounceTimer.unref();
  return timer.tumachBookingTimer;
}
