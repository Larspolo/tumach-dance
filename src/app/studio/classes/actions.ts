"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { routing } from "@/i18n/routing";
import { getStudioSession } from "@/lib/auth";
import { applyClassForm } from "@/lib/class-form";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** The one server action of the classes page (#96). A server action is a public endpoint: check the session here. */
export async function changeClass(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  applyClassForm(getDb(), session, form);
  revalidatePath("/studio/classes");
  // The home page shows the classes: show the change at once in each language.
  for (const locale of routing.locales) revalidatePath(`/${locale}`);
}
