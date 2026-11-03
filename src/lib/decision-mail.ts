// The decision email after the undo time (#572, epic #568): a tap on Approve or Decline sends no email at once, so
// that Nina can undo a wrong tap for `UNDO_MS`. Two callers send the due emails: a short timer of the tap (the email
// goes about one minute after it), and the booking timer each 5 minutes (also after a restart of the server inside the
// undo time). `claimDueDecisions()` gives each booking to one caller only.
import type { Db } from "../db";
import { claimDueDecisions, UNDO_MS } from "../db/bookings";
import { sendDecisionEmail } from "./booking-email";

/** Send the decision email of each decision whose undo time ended. Gives the ids of the claimed bookings. */
export async function sendDueDecisionEmails(db: Db, now = Date.now()): Promise<number[]> {
  const due = claimDueDecisions(db, now);
  for (const booking of due) {
    // A dancer whose data Nina removed in the undo time has no address: no email.
    if (booking.forgottenAt !== null) continue;
    await sendDecisionEmail(db, booking, booking.status === "approved" ? "approved" : "declined");
  }
  return due.map((b) => b.id);
}

/**
 * Send the due decision emails just after the undo time of a tap that is now. The timer does not keep the process
 * alive; when the server stops before it, the booking timer sends the email at its first check after the start.
 */
export function sendAfterUndoTime(db: () => Db): void {
  setTimeout(() => {
    sendDueDecisionEmails(db()).catch((error) => console.error("[decision-mail] the send failed:", error));
  }, UNDO_MS + 1_000).unref();
}
