"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { applyOfferForm } from "@/lib/offer-form";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** The one server action of the offers page (#31). A server action is a public endpoint: check the session here. */
export async function changeOffer(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  applyOfferForm(getDb(), session, form);
  revalidatePath("/studio/offers");
}
