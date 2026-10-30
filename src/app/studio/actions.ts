"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { renewCalendarToken } from "@/lib/calendar-token";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** A new address of the calendar feed (#104): the old address stops. A server action is public: check the session. */
export async function renewCalendar(): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  renewCalendarToken(getDb());
  redirect("/studio");
}
