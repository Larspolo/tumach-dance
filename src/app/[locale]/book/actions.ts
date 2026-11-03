"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requestBooking } from "@/db/bookings";
import { sendRequestEmail } from "@/lib/booking-email";
import { bookingError } from "@/lib/booking-error";
import { sendLimitPush } from "@/lib/booking-limit-push";
import { sendRequestPush } from "@/lib/booking-push";
import { clientAddress, formSpamReason } from "@/lib/contact-spam";
import { emailSuggestion } from "@/lib/email-typo";
import { turnstileReason } from "@/lib/turnstile";

/**
 * The booking request of a dancer (#36). `requestBooking()` checks each field and the time again on the server. A bot
 * (#374) gets the normal answer and makes no booking; a person over the limit of the address gets `error=limit`. A
 * request over the limit of the email address or of the day (#541) sends no email; the day limit tells Nina once.
 */
export async function sendRequest(form: FormData): Promise<void> {
  const text = (name: string) => String(form.get(name) ?? "");
  // "Use <suggestion>" sends the fixed address; "My address is right" sends `emailChecked` (#493).
  const fix = text("emailFix");
  if (fix) form.set("email", fix);
  const locale = text("locale");
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  const offerId = Number(text("offerId"));
  const start = Number(text("start"));
  const address = clientAddress(await headers());
  // Turnstile (#564) after the honeypot: a failed check goes back to the form with `error=check`, so a person can send again.
  const spam = (await formSpamReason("booking", form, address)) ?? (await turnstileReason(form, address));
  if (spam) {
    console.warn(`Booking: no request, spam (${spam})`);
    if (spam !== "limit" && spam !== "turnstile") redirect(`/${safeLocale}/book?sent=1`);
    const back = new URLSearchParams({
      offer: String(offerId),
      day: text("day"),
      start: String(start),
      error: spam === "turnstile" ? "check" : "limit",
    });
    redirect(`/${safeLocale}/book?${back}`);
  }
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
    note: text("note"),
    locale,
  });
  if (result.ok) {
    await sendRequestEmail(db, result.booking, safeLocale);
    await sendRequestPush(db, result.booking);
    redirect(`/${safeLocale}/book?sent=1`);
  }
  if (result.reason === "limit") {
    console.warn(`Booking: no request, limit (${result.limit})`);
    if (result.limit === "day") await sendLimitPush(db);
  }
  const day = text("day");
  const back = new URLSearchParams({ offer: String(offerId), day, error: bookingError(result) });
  if (result.reason === "invalid") back.set("start", String(start));
  redirect(`/${safeLocale}/book?${back}`);
}
