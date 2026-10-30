"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import type { HoursRule } from "@/lib/hours";
import { addClosed, addExtraOpen, removeDate } from "@/lib/hours-dates";
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

export type DateState = "idle" | "wrongPeriod" | "wrongDate";

async function changeRule(change: (rule: HoursRule) => HoursRule): Promise<DateState> {
  if (!(await getStudioSession(await headers()))) redirect(LOGIN_PATH);
  const db = getDb();
  try {
    saveHoursRule(db, change(getHoursRule(db)));
  } catch (error) {
    if (!(error instanceof RangeError)) throw error;
    return error.message.startsWith("A closed period ends") ? "wrongPeriod" : "wrongDate";
  }
  revalidatePath("/studio/hours");
  return "idle";
}

/** Close a date or a period (#24). */
export async function closeDates(_state: DateState, data: FormData): Promise<DateState> {
  return changeRule((rule) => addClosed(rule, data));
}

/** Open an extra day (#24). */
export async function openExtraDay(_state: DateState, data: FormData): Promise<DateState> {
  return changeRule((rule) => addExtraOpen(rule, data));
}

/** Remove a closed date or an extra open day (#24). */
export async function removeHoursDate(data: FormData): Promise<void> {
  const kind = data.get("kind") === "closed" ? "closed" : "extra";
  await changeRule((rule) => removeDate(rule, kind, String(data.get("key"))));
}
