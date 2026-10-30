"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { addPhoto, PhotoError, photosDir, removePhoto } from "@/db/photos";
import { getStudioSession } from "@/lib/auth";
import { LOGIN_PATH } from "@/lib/studio-paths";

/** Why a photo was not stored, or nothing when it was. */
export type UploadResult = { error?: PhotoError["reason"] };

async function checkSession(): Promise<void> {
  if (!(await getStudioSession(await headers()))) redirect(LOGIN_PATH);
}

/** Store one photo (#173). The page sends one file per request: a request stays below the body limit. */
export async function uploadPhoto(form: FormData): Promise<UploadResult> {
  await checkSession();
  const file = form.get("photo");
  if (!(file instanceof File)) return { error: "not-image" };
  try {
    await addPhoto(getDb(), photosDir(), Buffer.from(await file.arrayBuffer()));
  } catch (error) {
    if (error instanceof PhotoError) return { error: error.reason };
    throw error;
  }
  revalidatePath("/studio/photos");
  revalidatePath("/[locale]", "page");
  return {};
}

/** Remove one photo: the row and its files. */
export async function deletePhoto(form: FormData): Promise<void> {
  await checkSession();
  await removePhoto(getDb(), photosDir(), Number(form.get("id")));
  revalidatePath("/studio/photos");
  revalidatePath("/[locale]", "page");
}
