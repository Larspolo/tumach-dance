"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { sendMoveEmail } from "@/lib/booking-email";
import { moveByDancer } from "@/lib/booking-move-dancer";
import { sendMovePush, sendRequestPush } from "@/lib/booking-push";

/** The confirm button of the move page (#648). A server action is a public endpoint: the token is the only key. */
export async function moveWithLink(form: FormData): Promise<void> {
  const token = String(form.get("token") ?? "");
  const locale = String(form.get("locale") ?? "");
  const safeLocale = /^[a-z]{2}$/.test(locale) ? locale : "en";
  const db = getDb();
  const result = moveByDancer(db, token, Number(form.get("to")));
  if (result.ok) {
    await sendMoveEmail(db, result.booking, result.from, result.wasApproved);
    // A moved approved booking is a new request for Nina (#649): the request push.
    if (result.wasApproved) await sendRequestPush(db, result.booking);
    else await sendMovePush(db, result.booking, result.from);
  }
  const back = new URLSearchParams({ token });
  if (result.ok) back.set("done", "1");
  else if (result.state === "taken") back.set("taken", "1");
  redirect(`/${safeLocale}/booking/move?${back}`);
}
