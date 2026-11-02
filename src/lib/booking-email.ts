// The email to a dancer after a booking request (#37): the offer, the time, and that Nina answers soon.
// The email after Nina's decision (#77): approved or declined, with the same offer and time.
// The reminder the day before an approved booking (#165). The request and the approval email have the cancel link (#164).
// The texts are in `messages/` under `bookingEmail`; the time is in Europe/Amsterdam time, as Nina sees it.

import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Db } from "../db";
import type { Booking } from "../db/bookings";
import type { Offer } from "../db/offers";
import { offers } from "../db/schema";
import { cancelUrl } from "./booking-cancel";
import { bookingEvent } from "./booking-ics";
import { sendEmailFailPush } from "./booking-push";
import { type Email, sendEmail } from "./email";
import { type EmailBlock, emailHtml } from "./email-html";
import { TIME_ZONE } from "./hours";
import { siteOrigin } from "./site";
import { recordError } from "./site-errors";
import { studioAddress, studioEmail } from "./studio-email";

const MESSAGES = { en, nl } as const;

/** The translator of `locale` (English for another one), the label of the offer and the Amsterdam time of `booking`. */
function parts(booking: Booking, offer: Offer, locale: string) {
  const lang = locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
  const t = createTranslator({ locale: lang, messages: MESSAGES[lang] });
  const offerLabel =
    offer.kind === "lesson"
      ? t("Book.lesson", { minutes: offer.minutes })
      : t("Book.rental", { minutes: offer.minutes });
  return { t, offerLabel, when: whenText(lang, booking.start) };
}

/** The date and time of `ms` in Europe/Amsterdam time, in the format of `lang` (#410). */
function whenText(lang: string, ms: number): string {
  return new Intl.DateTimeFormat(lang, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" }).format(
    new Date(ms),
  );
}

/** The price of `offer` in euro, in the format of `locale`. */
function priceText(offer: Offer, locale: string): string {
  const lang = locale in MESSAGES ? locale : "en";
  return new Intl.NumberFormat(lang, { style: "currency", currency: "EUR" }).format(offer.priceCents / 100);
}

/** Reply goes to Nina's Gmail (#375): the dancer's answer reaches her. No value: no Reply-To. */
function replyToNina(): Pick<Email, "replyTo"> {
  const address = studioEmail();
  return address ? { replyTo: address } : {};
}

/** The calendar file of a booking as an email attachment (#166, #385). */
function icsAttachment(booking: Booking, offer: Offer, cancel = false) {
  return {
    filename: "tumach.ics",
    contentType: "text/calendar",
    content: bookingEvent(booking, offer, booking.locale, cancel),
  };
}

/** The email to the dancer of a `requested` booking, in the language of the page (`locale`). */
export function requestEmail(booking: Booking, offer: Offer, locale: string, origin = siteOrigin()): Email {
  const { t, offerLabel, when } = parts(booking, offer, locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.body", { offer: offerLabel, when }),
    "",
    t("bookingEmail.soon"),
    "",
    t("bookingEmail.cancelLink", { url: cancelUrl(origin, booking) }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return { to: booking.email, subject: t("bookingEmail.subject"), text, ...replyToNina() };
}

/** The line with the address of the studio and an empty line, or nothing with no `STUDIO_ADDRESS` (#540). */
function addressLines(t: ReturnType<typeof parts>["t"]): string[] {
  const address = studioAddress();
  return address ? [t("bookingEmail.address", { address }), ""] : [];
}

export type Decision = "approved" | "declined";

/** The email to the dancer after Nina's decision, in the language of the booking (`booking.locale`). */
export function decisionEmail(booking: Booking, offer: Offer, decision: Decision, origin = siteOrigin()): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const lines =
    decision === "approved"
      ? [
          t("bookingEmail.approvedBody", { offer: offerLabel, when }),
          "",
          ...addressLines(t),
          // The payment of `book:pay` (#142): the price, and Nina's Tikkie link or that she sends a Tikkie.
          booking.tikkieUrl
            ? t("bookingEmail.payLink", { price: priceText(offer, booking.locale), url: booking.tikkieUrl })
            : t("bookingEmail.payLater", { price: priceText(offer, booking.locale) }),
          "",
          t("bookingEmail.cancelLink", { url: cancelUrl(origin, booking) }),
          "",
          t("bookingEmail.approvedSee"),
        ]
      : [t("bookingEmail.declinedBody", { offer: offerLabel, when }), "", t("bookingEmail.declinedOther")];
  const text = [t("bookingEmail.greeting", { name: booking.name }), "", ...lines, "", t("bookingEmail.sign")].join(
    "\n",
  );
  const subject = decision === "approved" ? t("bookingEmail.approvedSubject") : t("bookingEmail.declinedSubject");
  // The calendar file (#385): the dancer adds the lesson with one tap at the approval. Same uid as the reminder.
  const attachments = decision === "approved" ? [icsAttachment(booking, offer)] : undefined;
  return { to: booking.email, subject, text, ...(attachments ? { attachments } : {}), ...replyToNina() };
}

/**
 * `decisionEmail()` with the HTML part: the approval (#439) has a button to pay and a button to cancel; the declined
 * email (#466) has a button to book another time. Async: React Email renders async.
 */
export async function decisionEmailHtml(
  booking: Booking,
  offer: Offer,
  decision: Decision,
  origin = siteOrigin(),
): Promise<Email> {
  const email = decisionEmail(booking, offer, decision, origin);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  if (decision !== "approved") {
    return withHtml(email, { lang: langOf(booking.locale), name: booking.name, t }, [
      { text: t("bookingEmail.declinedBody", { offer: offerLabel, when }) },
      {
        text: t("bookingEmail.declinedOther"),
        button: { label: t("bookingEmail.bookButton"), url: bookUrl(origin, booking.locale) },
      },
    ]);
  }
  return { ...email, html: await approvedHtml(booking, offer, t, offerLabel, when, origin) };
}

function approvedHtml(
  booking: Booking,
  offer: Offer,
  t: ReturnType<typeof parts>["t"],
  offerLabel: string,
  when: string,
  origin: string,
): Promise<string> {
  const price = priceText(offer, booking.locale);
  return emailHtml({
    lang: booking.locale in MESSAGES ? booking.locale : "en",
    greeting: t("bookingEmail.greeting", { name: booking.name }),
    blocks: [
      { text: t("bookingEmail.approvedBody", { offer: offerLabel, when }) },
      ...addressLines(t)
        .filter(Boolean)
        .map((text) => ({ text })),
      booking.tikkieUrl
        ? {
            text: t("bookingEmail.payPrice", { price }),
            button: { label: t("bookingEmail.payButton"), url: booking.tikkieUrl },
          }
        : { text: t("bookingEmail.payLater", { price }) },
      {
        text: t("bookingEmail.cancelText"),
        button: { label: t("bookingEmail.cancelButton"), url: cancelUrl(origin, booking) },
      },
      { text: t("bookingEmail.approvedSee") },
    ],
    sign: t("bookingEmail.sign"),
  });
}

/** Who cancelled a booking: Nina in her app (#162) or the dancer with the link of the email (#164). */
export type CancelledBy = "nina" | "dancer";

/**
 * The email to the dancer after a booking is cancelled (#160), in the language of the booking. An approved booking
 * (`wasApproved`, #386) gets the cancel file that removes its event from the calendar of the dancer.
 */
export function cancelEmail(booking: Booking, offer: Offer, by: CancelledBy = "nina", wasApproved = false): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t(by === "dancer" ? "bookingEmail.cancelledByYou" : "bookingEmail.cancelled", { offer: offerLabel, when }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  const attachments = wasApproved ? [icsAttachment(booking, offer, true)] : undefined;
  return {
    to: booking.email,
    subject: t("bookingEmail.cancelledSubject"),
    text,
    ...(attachments ? { attachments } : {}),
    ...replyToNina(),
  };
}

/**
 * The email to the dancer after Nina moved a booking (#410), in the language of the booking: the old and the new time.
 * An approved booking gets the calendar file with the new time and the next sequence: the event moves in the calendar.
 */
export function moveEmail(booking: Booking, offer: Offer, from: { start: number }, origin = siteOrigin()): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.move", {
      offer: offerLabel,
      from: whenText(booking.locale in MESSAGES ? booking.locale : "en", from.start),
      when,
    }),
    "",
    t("bookingEmail.cancelLink", { url: cancelUrl(origin, booking) }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  const attachments = booking.status === "approved" ? [icsAttachment(booking, offer)] : undefined;
  return {
    to: booking.email,
    subject: t("bookingEmail.moveSubject"),
    text,
    ...(attachments ? { attachments } : {}),
    ...replyToNina(),
  };
}

/** The email to the dancer when Nina did not answer a request before its start (#340), in the language of the booking. */
export function unansweredEmail(booking: Booking, offer: Offer, origin = siteOrigin()): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.unansweredBody", { offer: offerLabel, when }),
    "",
    t("bookingEmail.unansweredOther", { url: `${origin}/${booking.locale}/book` }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return { to: booking.email, subject: t("bookingEmail.unansweredSubject"), text, ...replyToNina() };
}

/** The reminder to the dancer the day before an approved booking (#165), in the language of the booking. */
export function reminderEmail(booking: Booking, offer: Offer): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.reminder", { offer: offerLabel, when }),
    "",
    ...addressLines(t),
    t("bookingEmail.approvedSee"),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return {
    to: booking.email,
    subject: t("bookingEmail.reminderSubject"),
    text,
    attachments: [icsAttachment(booking, offer)],
    ...replyToNina(),
  };
}

/** The payment reminder to a dancer who did not pay an approved booking (#167), in the language of the booking. */
export function paymentReminderEmail(booking: Booking, offer: Offer): Email {
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const price = priceText(offer, booking.locale);
  const text = [
    t("bookingEmail.greeting", { name: booking.name }),
    "",
    t("bookingEmail.payReminder", { offer: offerLabel, when }),
    "",
    booking.tikkieUrl
      ? t("bookingEmail.payLink", { price, url: booking.tikkieUrl })
      : t("bookingEmail.payLater", { price }),
    "",
    t("bookingEmail.sign"),
  ].join("\n");
  return { to: booking.email, subject: t("bookingEmail.payReminderSubject"), text, ...replyToNina() };
}

type Translator = ReturnType<typeof parts>["t"];

/** The language of the HTML part and of the links: `locale`, English for another one. */
function langOf(locale: string): keyof typeof MESSAGES {
  return locale in MESSAGES ? (locale as keyof typeof MESSAGES) : "en";
}

/** `email` with the HTML part (#440): the greeting, the `blocks` (a button under a paragraph) and the sign-off. */
async function withHtml(
  email: Email,
  ctx: { lang: string; name: string; t: Translator },
  blocks: EmailBlock[],
): Promise<Email> {
  const html = await emailHtml({
    lang: ctx.lang,
    greeting: ctx.t("bookingEmail.greeting", { name: ctx.name }),
    blocks,
    sign: ctx.t("bookingEmail.sign"),
  });
  return { ...email, html };
}

/** The block with the cancel button (#440), the same text as the cancel link of the plain part. */
function cancelBlock(t: Translator, url: string): EmailBlock {
  return { text: t("bookingEmail.cancelText"), button: { label: t("bookingEmail.cancelButton"), url } };
}

/** The booking page of `locale`: the button to pick another time. */
const bookUrl = (origin: string, locale: string) => `${origin}/${locale}/book`;

/** `requestEmail()` with the HTML part (#440): a button to cancel. */
export async function requestEmailHtml(
  booking: Booking,
  offer: Offer,
  locale: string,
  origin = siteOrigin(),
): Promise<Email> {
  const email = requestEmail(booking, offer, locale, origin);
  const { t, offerLabel, when } = parts(booking, offer, locale);
  return withHtml(email, { lang: langOf(locale), name: booking.name, t }, [
    { text: t("bookingEmail.body", { offer: offerLabel, when }) },
    { text: t("bookingEmail.soon") },
    cancelBlock(t, cancelUrl(origin, booking)),
  ]);
}

/** `cancelEmail()` with the HTML part (#440): a button to pick another time. */
export async function cancelEmailHtml(
  booking: Booking,
  offer: Offer,
  by: CancelledBy = "nina",
  wasApproved = false,
  origin = siteOrigin(),
): Promise<Email> {
  const email = cancelEmail(booking, offer, by, wasApproved);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const lang = langOf(booking.locale);
  return withHtml(email, { lang, name: booking.name, t }, [
    {
      text: t(by === "dancer" ? "bookingEmail.cancelledByYou" : "bookingEmail.cancelled", { offer: offerLabel, when }),
      button: { label: t("bookingEmail.bookButton"), url: bookUrl(origin, booking.locale) },
    },
  ]);
}

/** `moveEmail()` with the HTML part (#440): a button to cancel. */
export async function moveEmailHtml(
  booking: Booking,
  offer: Offer,
  from: { start: number },
  origin = siteOrigin(),
): Promise<Email> {
  const email = moveEmail(booking, offer, from, origin);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const lang = langOf(booking.locale);
  return withHtml(email, { lang, name: booking.name, t }, [
    { text: t("bookingEmail.move", { offer: offerLabel, from: whenText(lang, from.start), when }) },
    cancelBlock(t, cancelUrl(origin, booking)),
  ]);
}

/** `unansweredEmail()` with the HTML part (#440): a button to pick another time. */
export async function unansweredEmailHtml(booking: Booking, offer: Offer, origin = siteOrigin()): Promise<Email> {
  const email = unansweredEmail(booking, offer, origin);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  return withHtml(email, { lang: langOf(booking.locale), name: booking.name, t }, [
    { text: t("bookingEmail.unansweredBody", { offer: offerLabel, when }) },
    {
      text: t("bookingEmail.declinedOther"),
      button: { label: t("bookingEmail.bookButton"), url: bookUrl(origin, booking.locale) },
    },
  ]);
}

/** `reminderEmail()` with the HTML part (#440): a button to cancel. */
export async function reminderEmailHtml(booking: Booking, offer: Offer, origin = siteOrigin()): Promise<Email> {
  const email = reminderEmail(booking, offer);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  return withHtml(email, { lang: langOf(booking.locale), name: booking.name, t }, [
    { text: t("bookingEmail.reminder", { offer: offerLabel, when }) },
    ...addressLines(t)
      .filter(Boolean)
      .map((text) => ({ text })),
    cancelBlock(t, cancelUrl(origin, booking)),
    { text: t("bookingEmail.approvedSee") },
  ]);
}

/** `paymentReminderEmail()` with the HTML part (#440): a pay button when the booking has a Tikkie link. */
export async function paymentReminderEmailHtml(booking: Booking, offer: Offer): Promise<Email> {
  const email = paymentReminderEmail(booking, offer);
  const { t, offerLabel, when } = parts(booking, offer, booking.locale);
  const price = priceText(offer, booking.locale);
  return withHtml(email, { lang: langOf(booking.locale), name: booking.name, t }, [
    { text: t("bookingEmail.payReminder", { offer: offerLabel, when }) },
    booking.tikkieUrl
      ? {
          text: t("bookingEmail.payPrice", { price }),
          button: { label: t("bookingEmail.payButton"), url: booking.tikkieUrl },
        }
      : { text: t("bookingEmail.payLater", { price }) },
  ]);
}

/**
 * Send the request email after `requestBooking()` gave `ok`. A failed email does not undo the booking: the error is
 * logged, and the dancer's request is still stored for Nina.
 */
export async function sendRequestEmail(db: Db, booking: Booking, locale: string): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(await requestEmailHtml(booking, offer, locale));
  } catch (error) {
    console.error(`[booking-email] the email of booking ${booking.id} failed:`, error);
    recordError("email: request", error);
    await sendEmailFailPush(db, booking, "request");
  }
}

/**
 * Send the decision email after `decideBooking()` gave `ok`. A failed email does not undo the decision: the error is
 * logged, and Nina's decision stays.
 */
export async function sendDecisionEmail(db: Db, booking: Booking, decision: Decision): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(await decisionEmailHtml(booking, offer, decision));
  } catch (error) {
    console.error(`[booking-email] the decision email of booking ${booking.id} failed:`, error);
    recordError("email: decision", error);
    await sendEmailFailPush(db, booking, "decision");
  }
}

/**
 * Send the cancel email after a booking is cancelled. A failed email does not undo the cancellation: the error is
 * logged, and the cancelled booking stays.
 */
export async function sendCancelEmail(
  db: Db,
  booking: Booking,
  by: CancelledBy = "nina",
  wasApproved = false,
): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(await cancelEmailHtml(booking, offer, by, wasApproved));
  } catch (error) {
    console.error(`[booking-email] the cancel email of booking ${booking.id} failed:`, error);
    recordError("email: cancel", error);
    await sendEmailFailPush(db, booking, "cancel");
  }
}

/**
 * Send the move email after `moveBooking()` gave `ok`. A failed email does not undo the move: the error is logged,
 * and the moved booking stays.
 */
export async function sendMoveEmail(db: Db, booking: Booking, from: { start: number; end: number }): Promise<void> {
  try {
    const offer = db.select().from(offers).where(eq(offers.id, booking.offerId)).get();
    if (!offer) throw new Error(`Booking email: offer ${booking.offerId} not found`);
    await sendEmail(await moveEmailHtml(booking, offer, from));
  } catch (error) {
    console.error(`[booking-email] the move email of booking ${booking.id} failed:`, error);
    recordError("email: move", error);
    await sendEmailFailPush(db, booking, "move");
  }
}
