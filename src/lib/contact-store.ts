// The contact messages in the studio app (#533): each message of the contact form is stored, Nina gets a push, reads
// it on the page "Messages" and answers it there. The answer goes to the visitor as a formatted email in the
// language of the visitor. A message is removed `MESSAGE_KEEP_MONTHS` after it came (the privacy page says so).
import { desc, eq, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Db } from "../db";
import { contactMessages } from "../db/schema";
import { withFallback } from "../i18n/fallback";
import type { Contact } from "./contact";
import { type Email, sendEmail } from "./email";
import { emailHtml } from "./email-html";
import { TIME_ZONE } from "./hours";
import { type PushLocale, type PushMessage, sendPush } from "./push";
import { studioEmail } from "./studio-email";

export type ContactMessage = typeof contactMessages.$inferSelect;
export type MessageLocale = "en" | "nl";

/** The months that the site keeps a contact message. */
export const MESSAGE_KEEP_MONTHS = 6;
export const MESSAGES_PATH = "/studio/messages";
export const ANSWER_MAX = 5000;

const MESSAGES = { en, nl: withFallback(nl, en) };

/** The language of the answer email: the language of the site of the visitor, else English. */
export function messageLocale(locale: unknown): MessageLocale {
  return locale === "nl" ? "nl" : "en";
}

/** Store a message of the contact form; gives the stored row. */
export function saveContactMessage(db: Db, value: Contact, locale: string, now = Date.now()): ContactMessage {
  return db
    .insert(contactMessages)
    .values({ ...value, locale: messageLocale(locale), createdAt: now })
    .returning()
    .get();
}

/** All stored messages, newest first. */
export function listContactMessages(db: Db): ContactMessage[] {
  return db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).all();
}

/** The count of messages with no answer, for the button of the start page. */
export function countUnanswered(db: Db): number {
  return listContactMessages(db).filter((m) => m.answeredAt === null).length;
}

/** The push of a new message, in the language of Nina's device. */
export function messagePush(message: ContactMessage, locale: PushLocale): PushMessage {
  const lang = messageLocale(locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  return {
    title: t("StudioMessages.pushTitle", { name: message.name }),
    body: message.message.slice(0, 120),
    url: MESSAGES_PATH,
  };
}

/** Send the push of a new message. A failed push is logged: the message is stored and the email to Nina goes out. */
export async function sendMessagePush(db: Db, message: ContactMessage): Promise<void> {
  try {
    await sendPush(db, (locale) => messagePush(message, locale));
  } catch (error) {
    console.error(`[contact-store] the push of message ${message.id} failed:`, error);
  }
}

/** The email of Nina's answer to the visitor: a plain part and the HTML part of the site look. */
export async function answerEmail(message: ContactMessage, answer: string): Promise<Email> {
  const lang = messageLocale(message.locale);
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const greeting = t("bookingEmail.greeting", { name: message.name });
  const sign = t("bookingEmail.sign");
  const quote = t("ContactAnswer.quote", { message: message.message });
  const text = [greeting, "", answer, "", sign, "", "---", quote].join("\n");
  const html = await emailHtml({
    lang,
    greeting,
    blocks: [...answer.split(/\n{2,}/).map((part) => ({ text: part })), { text: quote }],
    sign,
  });
  // The Reply button of the visitor writes to Nina.
  const replyTo = studioEmail();
  return { to: message.email, subject: t("ContactAnswer.subject"), text, html, ...(replyTo ? { replyTo } : {}) };
}

export type AnswerResult = "sent" | "notFound" | "empty";

/** Send Nina's answer to message `id` and mark it answered. A failed email throws and marks nothing. */
export async function answerContactMessage(
  db: Db,
  id: number,
  answer: string,
  now = Date.now(),
): Promise<AnswerResult> {
  const text = answer.trim();
  if (text === "" || text.length > ANSWER_MAX) return "empty";
  const message = db.select().from(contactMessages).where(eq(contactMessages.id, id)).get();
  if (!message) return "notFound";
  await sendEmail(await answerEmail(message, text));
  db.update(contactMessages).set({ answer: text, answeredAt: now }).where(eq(contactMessages.id, id)).run();
  return "sent";
}

/** Remove each message older than `MESSAGE_KEEP_MONTHS`; gives the removed ids. */
export function forgetOldMessages(db: Db, now = Date.now()): number[] {
  const limit = DateTime.fromMillis(now, { zone: TIME_ZONE }).minus({ months: MESSAGE_KEEP_MONTHS }).toMillis();
  return db
    .delete(contactMessages)
    .where(lt(contactMessages.createdAt, limit))
    .returning({ id: contactMessages.id })
    .all()
    .map((row) => row.id);
}
