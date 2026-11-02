import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listBookings, listOpenRequests } from "@/db/bookings";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName, shownNote } from "@/lib/booking-name";
import { TIME_ZONE } from "@/lib/hours";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { whatsappLink } from "@/lib/whatsapp";
import styles from "../studio.module.css";
import { decide, pay } from "./actions";

const DAY = 24 * 60 * 60_000;

// The open booking requests (#76): Nina approves or declines each with one tap. One form and one server action.
// The approved bookings of 30 days back to 90 days ahead (#143): Nina marks each paid with one tap, or undoes it.
export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ done?: string; error?: string }>;
}) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioBookings");
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");
  const { done, error } = await searchParams;
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, day: "numeric", month: "short" });
  // The WhatsApp first line is in the language of the booking (#496), not of the studio app.
  const bookingT = {
    en: await getTranslations({ locale: "en", namespace: "StudioBookings" }),
    nl: await getTranslations({ locale: "nl", namespace: "StudioBookings" }),
  };
  const whatsappHref = (booking: { phone: string; locale: string; name: string; start: number }): string | null => {
    const lang = booking.locale === "nl" ? "nl" : "en";
    const date = new Intl.DateTimeFormat(lang, {
      timeZone: TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(booking.start);
    return whatsappLink(booking.phone, bookingT[lang]("whatsappText", { name: booking.name, date }));
  };
  const db = getDb();
  const now = Date.now();
  const requests = listOpenRequests(db, now);
  const approved = listBookings(db, now - 30 * DAY, now + 90 * DAY, ["approved"]);

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      {done === "approved" && <p className={styles.note}>{t("approved")}</p>}
      {done === "declined" && <p className={styles.note}>{t("declined")}</p>}
      {error === "link" && <p className={styles.note}>{t("badLink")}</p>}
      {requests.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {requests.map(({ booking, offer }) => (
          <li key={booking.id} className={styles.item}>
            <strong>{offerName(offer.kind, { minutes: offer.minutes })}</strong>
            <p>{when.format(booking.start)}</p>
            <p>{shownName(booking, weekName("removed"))}</p>
            <p>
              <a className={styles.link} href={`mailto:${booking.email}`}>
                {booking.email}
              </a>
            </p>
            <p>
              <a className={styles.link} href={`tel:${booking.phone.replace(/[^\d+]/g, "")}`}>
                {booking.phone}
              </a>
            </p>
            {whatsappHref(booking) !== null && (
              <p>
                <a className={styles.link} href={whatsappHref(booking) ?? undefined}>
                  {t("whatsapp")}
                </a>
              </p>
            )}
            {shownNote(booking) !== null && <p className={styles.dancerNote}>{shownNote(booking)}</p>}
            <form className={styles.form} action={decide}>
              <input type="hidden" name="id" value={booking.id} />
              <label className={styles.label}>
                {t("tikkie")}
                <input className={styles.input} type="url" name="tikkie" />
              </label>
              <button className={styles.button} type="submit" name="decision" value="approved">
                {t("approve")}
              </button>
              <button className={styles.link} type="submit" name="decision" value="declined">
                {t("decline")}
              </button>
            </form>
          </li>
        ))}
      </ul>
      {approved.length > 0 && <h2 className={styles.title}>{t("toPay")}</h2>}
      <ul className={styles.list}>
        {approved.map(({ booking, offer }) => (
          <li key={booking.id} className={styles.item}>
            <strong>{offerName(offer.kind, { minutes: offer.minutes })}</strong>
            <p>{when.format(booking.start)}</p>
            <p>{shownName(booking, weekName("removed"))}</p>
            <form className={styles.form} action={pay}>
              <input type="hidden" name="id" value={booking.id} />
              {booking.paidAt === null ? (
                <button className={styles.button} type="submit" name="paid" value="paid">
                  {t("markPaid")}
                </button>
              ) : (
                <>
                  <p>{t("paidOn", { date: day.format(booking.paidAt) })}</p>
                  <button className={styles.link} type="submit" name="paid" value="undo">
                    {t("undo")}
                  </button>
                </>
              )}
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
