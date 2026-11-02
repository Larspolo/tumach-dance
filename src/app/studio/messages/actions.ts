"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getStudioSession } from "@/lib/auth";
import { answerContactMessage, MESSAGES_PATH } from "@/lib/contact-store";
import { recordError } from "@/lib/site-errors";
import { LOGIN_PATH } from "@/lib/studio-paths";

export type ReplyState = { error: boolean; empty?: boolean; text: string };

/** Send Nina's answer to a contact message (#533). A server action is a public endpoint: check the session here. */
export async function sendReply(_state: ReplyState, form: FormData): Promise<ReplyState> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const id = Number(form.get("id"));
  const text = typeof form.get("text") === "string" ? (form.get("text") as string) : "";
  let result: Awaited<ReturnType<typeof answerContactMessage>>;
  try {
    result = await answerContactMessage(getDb(), id, text);
  } catch (error) {
    console.error("Contact: the answer email failed", error);
    recordError("email: contact answer", error);
    // Keep her answer in the form: she can send it again.
    return { error: true, text };
  }
  if (result === "empty") return { error: false, empty: true, text };
  redirect(`${MESSAGES_PATH}?sent=${id}`);
}
