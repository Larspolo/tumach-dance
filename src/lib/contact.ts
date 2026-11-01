// The contact message of a visitor to Nina (#150): checked, then sent by email with the visitor's address as Reply-To,
// so that Nina's Reply button of Gmail answers the visitor. The texts are in `messages/` under `Contact`.
// The language of the email is the one of Nina's newest studio device (its push row), else English.

import { desc } from "drizzle-orm";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Db } from "../db";
import { pushSubscriptions } from "../db/schema";
import { withFallback } from "../i18n/fallback";
import { studioEmail } from "./auth";
import { type Email, sendEmail } from "./email";

const MESSAGES = { en, nl: withFallback(nl, en) };

export type Contact = { name: string; email: string; message: string };
export type ContactField = keyof Contact;
/** The message key of the error of each bad field, as in `messages/` (`Contact.errors`). */
export type ContactErrors = Partial<Record<ContactField, `Contact.errors.${ContactField}`>>;

const NAME_MAX = 100;
const EMAIL_MAX = 254;
const MESSAGE_MAX = 5000;
// One "@", no space, and a dot in the domain.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The fields of the contact form, trimmed and checked; one error key per bad field. */
export function parseContact(form: FormData): { ok: true; value: Contact } | { ok: false; errors: ContactErrors } {
  const read = (key: string) => {
    const value = form.get(key);
    return typeof value === "string" ? value.trim() : "";
  };
  const value = { name: read("name"), email: read("email"), message: read("message") };
  const errors: ContactErrors = {};
  if (value.name.length < 1 || value.name.length > NAME_MAX || /[\r\n]/.test(value.name)) {
    errors.name = "Contact.errors.name";
  }
  if (value.email.length > EMAIL_MAX || !EMAIL_PATTERN.test(value.email)) {
    errors.email = "Contact.errors.email";
  }
  if (value.message.length < 1 || value.message.length > MESSAGE_MAX) {
    errors.message = "Contact.errors.message";
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, value };
}

/** The email to Nina for `value`, in `locale` (English for another one). Throws with no `STUDIO_EMAIL`. */
export function contactEmail(value: Contact, locale: string): Email {
  const to = studioEmail();
  if (!to) throw new Error("Contact: set STUDIO_EMAIL in the .env of the server");
  const lang = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const text = [
    `${t("Contact.name")}: ${value.name}`,
    `${t("Contact.email")}: ${value.email}`,
    "",
    `${t("Contact.message")}:`,
    value.message,
  ].join("\n");
  return { to, subject: t("Contact.subject", { name: value.name }), text, replyTo: value.email };
}

/** Send the contact message to Nina, in the language of her newest studio device. */
export async function sendContactMessage(db: Db, value: Contact): Promise<void> {
  const newest = db
    .select({ locale: pushSubscriptions.locale })
    .from(pushSubscriptions)
    .orderBy(desc(pushSubscriptions.createdAt))
    .limit(1)
    .get();
  await sendEmail(contactEmail(value, newest?.locale ?? "en"));
}
