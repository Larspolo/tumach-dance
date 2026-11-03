"use server";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { parseNewsNote, removeNewsNote, saveNewsNote } from "@/lib/news-note";
import { LOGIN_PATH } from "@/lib/studio-paths";

const PAGE = "/studio/news";

/** Save the note of the home page (#654), or go back with the error key. */
export async function saveNews(data: FormData): Promise<void> {
  if (!(await getStudioSession(await headers()))) redirect(LOGIN_PATH);
  const result = parseNewsNote(String(data.get("text") ?? ""), String(data.get("until") ?? ""));
  if ("error" in result) redirect(`${PAGE}?error=${result.error}`);
  saveNewsNote(getDb(), result.note);
  revalidatePath("/[locale]", "page");
  redirect(`${PAGE}?done=saved`);
}

/** Remove the note: the home page shows none (#654). */
export async function removeNews(): Promise<void> {
  if (!(await getStudioSession(await headers()))) redirect(LOGIN_PATH);
  removeNewsNote(getDb());
  revalidatePath("/[locale]", "page");
  redirect(`${PAGE}?done=removed`);
}
