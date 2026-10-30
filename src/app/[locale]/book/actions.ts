"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { requestBooking } from "@/db/bookings";

/** The booking request of a dancer (#36). `requestBooking()` checks each field and the time again on the server. */
export async function sendRequest(form: FormData): Promise<void> {
  const text = (name: string) => String(form.get(name) ?? "");
  const locale = text("locale");
  const offerId = Number(text("offerId"));
  const start = Number(text("start"));
  const result = requestBooking(getDb(), {
    offerId,
    start,
    end: Number(text("end")),
    name: text("name"),
    email: text("email"),
    phone: text("phone"),
    locale,
  });
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  if (result.ok) redirect(`/${safeLocale}/book?sent=1`);
  const day = text("day");
  const back = new URLSearchParams({ offer: String(offerId), day, error: result.reason });
  if (result.reason === "invalid") back.set("start", String(start));
  redirect(`/${safeLocale}/book?${back}`);
}
