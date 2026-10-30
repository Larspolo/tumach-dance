"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { cancelByDancer } from "@/lib/booking-cancel";
import { sendCancelEmail } from "@/lib/booking-email";

/** The "Cancel" button of the cancel link (#164). A server action is a public endpoint: the token is the only key. */
export async function cancelWithLink(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const locale = String(form.get("locale") ?? "");
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  const db = getDb();
  const result = cancelByDancer(db, token);
  if (result.ok) await sendCancelEmail(db, result.booking, "dancer");
  // The page shows the new state: cancelled, or why nothing changed (a second tap, an old link, a started booking).
  const back = new URLSearchParams({ token });
  if (result.ok) back.set("done", "1");
  redirect(`/${safeLocale}/booking/cancel?${back}`);
}
