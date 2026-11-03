"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { setDancerNote } from "@/db/dancer-notes";
import { bookings } from "@/db/schema";
import { getStudioSession } from "@/lib/auth";
import { backPath, LOGIN_PATH } from "@/lib/studio-paths";

/** Save Nina's private note about the dancer of one booking (#696); an empty note removes it. A server action is a public endpoint: check the session here. */
export async function saveDancerNote(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const back = backPath(form.get("back"), "/studio/week");
  const id = Number(form.get("id"));
  if (Number.isInteger(id)) {
    const db = getDb();
    const booking = db.select().from(bookings).where(eq(bookings.id, id)).get();
    if (booking) setDancerNote(db, booking, String(form.get("note") ?? ""));
    redirect(`/studio/dancer/${id}?back=${encodeURIComponent(back)}`);
  }
  redirect(back);
}
