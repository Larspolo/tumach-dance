"use server";

import { headers } from "next/headers";
import { getDb } from "@/db";
import { type Contact, type ContactErrors, parseContact, sendContactMessage } from "@/lib/contact";
import { clientAddress, spamReason } from "@/lib/contact-spam";

/** `values`: the text of the visitor, kept in the form after an error (#152). */
export type ContactState = {
  status: "idle" | "sent" | "invalid" | "failed";
  errors: ContactErrors;
  values: Contact;
};

const EMPTY: Contact = { name: "", email: "", message: "" };

/**
 * The server action of the contact form of the home page (#152): check, then send the email to Nina. A bot (#151)
 * gets the normal `sent` answer and no email goes out.
 */
export async function sendContact(_prev: ContactState, form: FormData): Promise<ContactState> {
  const values = {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    message: String(form.get("message") ?? ""),
  };
  const parsed = parseContact(form);
  if (!parsed.ok) return { status: "invalid", errors: parsed.errors, values };
  const spam = await spamReason(form, clientAddress(await headers()));
  if (spam) {
    console.warn(`Contact: no email, spam (${spam})`);
    return { status: "sent", errors: {}, values: EMPTY };
  }
  try {
    await sendContactMessage(getDb(), parsed.value);
  } catch (error) {
    console.error("Contact: the email failed", error);
    return { status: "failed", errors: {}, values };
  }
  return { status: "sent", errors: {}, values: EMPTY };
}
