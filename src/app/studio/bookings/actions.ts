"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { decideBooking, markPaid, unmarkPaid } from "@/db/bookings";
import { getStudioSession } from "@/lib/auth";
import { sendDecisionEmail } from "@/lib/booking-email";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** Approve or decline one request (#76) and email the dancer (#77). A server action is a public endpoint: check the session here. */
export async function decide(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const decision = form.get("decision");
  const id = Number(form.get("id"));
  if ((decision !== "approved" && decision !== "declined") || !Number.isInteger(id)) redirect("/studio/bookings");
  const db = getDb();
  const result = decideBooking(db, id, decision);
  if (result.ok) await sendDecisionEmail(db, result.booking, decision);
  // A second tap (or another device) finds the request already decided: show the list again with no line.
  redirect(result.ok ? `/studio/bookings?done=${decision}` : "/studio/bookings");
}

/** Mark an approved booking paid after Nina saw the Tikkie payment, or undo a wrong tap (#143). */
export async function pay(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) redirect("/studio/bookings");
  // A second tap (or another device) changes nothing: `markPaid()` keeps the first `paidAt`.
  if (form.get("paid") === "undo") unmarkPaid(getDb(), id);
  else markPaid(getDb(), id);
  redirect("/studio/bookings");
}
