"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStudioSession } from "@/lib/auth";
import { postNinaAnswer } from "@/lib/github";
import { LOGIN_PATH } from "@/lib/studio-paths";

export type AnswerState = { error: boolean; choice: string | null; text: string };

/** Send the answer of Nina to the ticket (#68). A server action is a public endpoint: check the session here. */
export async function sendAnswer(_state: AnswerState, form: FormData): Promise<AnswerState> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const number = Number(form.get("number"));
  const choice = typeof form.get("choice") === "string" ? (form.get("choice") as string) : null;
  const text = typeof form.get("text") === "string" ? (form.get("text") as string) : "";
  try {
    await postNinaAnswer(number, { choice, text });
  } catch {
    // Keep her answer in the form: she can send it again.
    return { error: true, choice, text };
  }
  // The question stays open on GitHub until a run reads the answer: the address hides it from the list.
  redirect(`/studio/questions?sent=${number}`);
}
