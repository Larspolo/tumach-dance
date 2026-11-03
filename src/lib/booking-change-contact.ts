import type { Db } from "@/db";
import type { ChangeContactResult } from "@/db/bookings";
import { sendDecisionEmail, sendRequestEmail } from "@/lib/booking-email";

/**
 * Send the last email of a booking again after Nina corrected its email address (#760): the request email for a
 * request, the approval email for an approved booking whose approval went out. An approval in its undo time goes
 * later by the timer (`claimDueDecisions()`) to the new address.
 */
export async function resendAfterContactChange(db: Db, result: ChangeContactResult): Promise<void> {
  if (!result.ok || !result.emailChanged) return;
  const { booking } = result;
  if (!booking.email?.trim()) return;
  if (booking.status === "requested") await sendRequestEmail(db, booking, booking.locale);
  else if (booking.status === "approved" && booking.decisionMailedAt != null)
    await sendDecisionEmail(db, booking, "approved");
}
