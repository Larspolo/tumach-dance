"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { decideBooking, markPaid, undoDecision, unmarkPaid } from "@/db/bookings";
import { getStudioSession } from "@/lib/auth";
import { sendAfterUndoTime } from "@/lib/decision-mail";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { tikkieLink } from "@/lib/tikkie";

/**
 * Approve or decline one request (#76). The email to the dancer (#77) goes when the undo time of the tap ends (#572).
 * A server action is a public endpoint: check the session here.
 */
export async function decide(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const decision = form.get("decision");
  const id = Number(form.get("id"));
  if ((decision !== "approved" && decision !== "declined") || !Number.isInteger(id)) redirect("/studio/bookings");
  // The optional Tikkie link of an approval (#142): only an `https://` URL.
  const link = decision === "approved" ? tikkieLink(form.get("tikkie")) : null;
  if (link === "invalid") redirect("/studio/bookings?error=link");
  const db = getDb();
  const result = decideBooking(db, id, decision, link);
  if (result.ok) sendAfterUndoTime(getDb);
  // A second tap (or another device) finds the request already decided: show the list again with no line.
  redirect(result.ok ? `/studio/bookings?done=${decision}&id=${id}` : "/studio/bookings");
}

/**
 * Undo a tap on Approve or Decline in its undo time (#573): the request is open again and the dancer gets no email.
 * The reasons of a failed undo: `sent`, `taken`, `started`; another reason shows the list with no line.
 */
export async function undo(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) redirect("/studio/bookings");
  const result = undoDecision(getDb(), id);
  if (result.ok) redirect("/studio/bookings?undone=1");
  const shown = result.reason === "sent" || result.reason === "taken" || result.reason === "started";
  redirect(shown ? `/studio/bookings?undo=${result.reason}` : "/studio/bookings");
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
