"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { removeBlock as deleteBlock } from "@/db/blocks";
import { addBooking, cancelBooking, moveBooking } from "@/db/bookings";
import { getStudioSession } from "@/lib/auth";
import { sendCancelEmail, sendMoveEmail } from "@/lib/booking-email";
import { forgetDancerOfBooking } from "@/lib/booking-forget";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { localDate, weekOf } from "@/lib/week";
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
    if (result.ok) await sendCancelEmail(db, result.booking, "nina", result.wasApproved);
  }
  redirect(`/studio/week?start=${week.start}`);
}

/** Remove the data of the dancer of one booking (#363): cancel their coming bookings with the email, then remove the data. */
export async function forget(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const week = weekOf(String(form.get("start") ?? ""));
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) await forgetDancerOfBooking(getDb(), id);
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

/**
 * Move one requested or approved booking to a free time (#411) and email the dancer. The week of the new time shows
 * next. A time that another booking took meanwhile shows the free times again with a message.
 */
export async function move(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const week = weekOf(String(form.get("start") ?? ""));
  const id = Number(form.get("id"));
  const to = Number(form.get("to"));
  if (!Number.isInteger(id)) redirect(`/studio/week?start=${week.start}`);
  const db = getDb();
  const result = moveBooking(db, id, to);
  if (result.ok) {
    await sendMoveEmail(db, result.booking, result.from);
    revalidatePath("/studio/week");
    redirect(`/studio/week?start=${weekOf(localDate(result.booking.start)).start}`);
  }
  if (result.reason === "taken" || result.reason === "notSlot") {
    redirect(`/studio/week?start=${week.start}&move=${id}&taken=1`);
  }
  redirect(`/studio/week?start=${week.start}`);
}

/**
 * Add a lesson that Nina agreed by WhatsApp or phone (#619) as an approved booking. With an email, the timer sends the
 * approval email (`claimDueDecisions()`). A time that another booking took meanwhile shows the free times again.
 */
export async function addLesson(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const week = weekOf(String(form.get("start") ?? ""));
  const offerId = Number(form.get("offerId"));
  const to = Number(form.get("to"));
  const locale = form.get("locale") === "nl" ? "nl" : "en";
  const result = addBooking(getDb(), {
    offerId,
    start: to,
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    phone: String(form.get("phone") ?? ""),
    locale,
  });
  const base = `/studio/week?start=${week.start}&lesson=1&offer=${offerId}`;
  if (result.ok) {
    revalidatePath("/studio/week");
    redirect(`/studio/week?start=${weekOf(localDate(result.booking.start)).start}`);
  }
  if (result.reason === "taken" || result.reason === "notSlot") redirect(`${base}&taken=1`);
  redirect(`${base}&day=${String(form.get("day") ?? "")}&to=${to}&wrong=1`);
}
