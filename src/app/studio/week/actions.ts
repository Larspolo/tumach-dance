"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { cancelBooking } from "@/db/bookings";
import { getStudioSession } from "@/lib/auth";
import { sendCancelEmail } from "@/lib/booking-email";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { weekOf } from "@/lib/week";

/** Cancel one requested or approved booking (#162) and email the dancer. A server action is a public endpoint: check the session here. */
export async function cancel(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const week = weekOf(String(form.get("start") ?? ""));
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) {
    const db = getDb();
    const result = cancelBooking(db, id);
    // A second tap (or another device) finds the booking already cancelled: show the week again.
    if (result.ok) await sendCancelEmail(db, result.booking);
  }
  redirect(`/studio/week?start=${week.start}`);
}
