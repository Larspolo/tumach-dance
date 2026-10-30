"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { routing } from "@/i18n/routing";
import { getStudioSession } from "@/lib/auth";
import { applyClassForm } from "@/lib/class-form";
import { applyClassTimeForm, type ClassTimeResult } from "@/lib/class-time-form";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** Show the change at once on the classes page and on the home page in each language (it shows the classes). */
function revalidateClasses(): void {
  revalidatePath("/studio/classes");
  for (const locale of routing.locales) revalidatePath(`/${locale}`);
}

/** The server action of the class form (#96). A server action is a public endpoint: check the session here. */
export async function changeClass(form: FormData): Promise<void> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  applyClassForm(getDb(), session, form);
  revalidateClasses();
}

/** The state of the time form: the result and, after a wrong time, the values that Nina typed (React resets the form). */
export type ClassTimeState = { result: ClassTimeResult; weekday?: string; from?: string; to?: string };

/** The server action of the weekly times of a class (#97); `useActionState` shows a wrong time. */
export async function changeClassTime(_state: ClassTimeState, form: FormData): Promise<ClassTimeState> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const result = applyClassTimeForm(getDb(), session, form);
  if (result !== "wrong") {
    revalidateClasses();
    return { result };
  }
  const value = (name: string) => String(form.get(name) ?? "");
  return { result, weekday: value("weekday"), from: value("from"), to: value("to") };
}

/** Remove a weekly time (#97): a plain form, no result to show. */
export async function removeTime(form: FormData): Promise<void> {
  await changeClassTime({ result: "none" }, form);
}
