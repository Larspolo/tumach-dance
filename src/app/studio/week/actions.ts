"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { removeBlock as deleteBlock } from "@/db/blocks";
import { cancelBooking } from "@/db/bookings";
import { getStudioSession } from "@/lib/auth";
import { sendCancelEmail } from "@/lib/booking-email";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { weekOf } from "@/lib/week";
import { addLocalBlock } from "@/lib/week-block";

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

/** Remove one time that Nina keeps free (#326). One tap: a block has no dancer to tell. */
export async function removeBlock(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const week = weekOf(String(form.get("start") ?? ""));
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) deleteBlock(getDb(), id);
  redirect(`/studio/week?start=${week.start}`);
}

/** Keep a time free on one day (#327): the local date and times of the form. A wrong input shows the form again with an error. */
export async function addBlock(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const date = String(form.get("date") ?? "");
  try {
    addLocalBlock(getDb(), { date, from: String(form.get("from") ?? ""), to: String(form.get("to") ?? "") });
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    redirect(`/studio/week?start=${weekOf(String(form.get("start") ?? "")).start}&add=wrong`);
  }
  redirect(`/studio/week?start=${weekOf(date).start}`);
}
