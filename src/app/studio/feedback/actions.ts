"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStudioSession } from "@/lib/auth";
import { createNinaFeedback } from "@/lib/github";
import { LOGIN_PATH } from "@/lib/studio-paths";

export type FeedbackState = { status: "idle" | "sent" | "failed"; text: string };

/** The server action of the feedback page (#108). A server action is a public endpoint: check the session here. */
export async function sendFeedback(_prev: FeedbackState, form: FormData): Promise<FeedbackState> {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const text = String(form.get("text") ?? "");
  const result = await createNinaFeedback(text);
  return result.ok ? { status: "sent", text: "" } : { status: "failed", text };
}
