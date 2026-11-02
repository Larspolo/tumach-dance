"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requestBooking } from "@/db/bookings";
import { sendRequestEmail } from "@/lib/booking-email";
import { sendRequestPush } from "@/lib/booking-push";
import { clientAddress, formSpamReason } from "@/lib/contact-spam";

/**
 * The booking request of a dancer (#36). `requestBooking()` checks each field and the time again on the server. A bot
 * (#374) gets the normal answer and makes no booking; a person over the limit of the address gets `error=limit`.
 */
export async function sendRequest(form: FormData): Promise<void> {
  const text = (name: string) => String(form.get(name) ?? "");
  const locale = text("locale");
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  const offerId = Number(text("offerId"));
  const start = Number(text("start"));
  const spam = await formSpamReason("booking", form, clientAddress(await headers()));
  if (spam) {
    console.warn(`Booking: no request, spam (${spam})`);
    if (spam !== "limit") redirect(`/${safeLocale}/book?sent=1`);
    const back = new URLSearchParams({
      offer: String(offerId),
      day: text("day"),
      start: String(start),
      error: "limit",
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
