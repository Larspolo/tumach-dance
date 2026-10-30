"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { formToRule, readHoursForm } from "@/lib/hours-form";
import { getHoursRule, saveHoursRule } from "@/lib/hours-store";
import { LOGIN_PATH } from "@/lib/studio-paths";

export type SaveState = "idle" | "saved" | "wrong";

/** The Server Action of the form (#23): save the rule, or keep the stored rule and show the error message. */
export async function saveHours(_state: SaveState, data: FormData): Promise<SaveState> {
  if (!(await getStudioSession(await headers()))) redirect(LOGIN_PATH);
  const db = getDb();
  try {
    saveHoursRule(db, formToRule(readHoursForm(data), getHoursRule(db)));
  } catch (error) {
    if (error instanceof RangeError) return "wrong";
    throw error;
  }
  revalidatePath("/studio/hours");
  return "saved";
}
