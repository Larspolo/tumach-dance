"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requestBooking } from "@/db/bookings";
import { sendRequestEmail } from "@/lib/booking-email";
import { sendRequestPush } from "@/lib/booking-push";
import { emailSuggestion } from "@/lib/email-typo";

/** The booking request of a dancer (#36). `requestBooking()` checks each field and the time again on the server. */
export async function sendRequest(form: FormData): Promise<void> {
  const text = (name: string) => String(form.get(name) ?? "");
  // "Use <suggestion>" sends the fixed address; "My address is right" sends `emailChecked` (#493).
  const fix = text("emailFix");
  if (fix) form.set("email", fix);
  const locale = text("locale");
  const offerId = Number(text("offerId"));
  const start = Number(text("start"));
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  // A likely typo in the email (#493): back to the form with the values and the fix; it holds no time.
  const typo = text("emailChecked") || fix ? null : emailSuggestion(text("email"));
  if (typo) {
    const fields = { name: text("name"), email: text("email"), phone: text("phone") };
    const back = new URLSearchParams({
      offer: String(offerId),
      day: text("day"),
      start: String(start),
      ...fields,
      typo,
    });
    redirect(`/${safeLocale}/book?${back}`);
  }
  const db = getDb();
  const result = requestBooking(db, {
    offerId,
    start,
    end: Number(text("end")),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    locale,
  });
  if (result.ok) {
    await sendRequestEmail(db, result.booking, safeLocale);
    await sendRequestPush(db, result.booking);
    redirect(`/${safeLocale}/book?sent=1`);
  }
  const day = text("day");
  const back = new URLSearchParams({ offer: String(offerId), day, error: result.reason });
  if (result.reason === "invalid") back.set("start", String(start));
  redirect(`/${safeLocale}/book?${back}`);
}
