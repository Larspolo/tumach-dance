import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { countOpenRequests } from "@/db/bookings";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName } from "@/lib/booking-name";
import { getCalendarToken } from "@/lib/calendar-token";
import { countUnanswered } from "@/lib/contact-store";
import { countNinaQuestions } from "@/lib/github";
import { TIME_ZONE } from "@/lib/hours";
import { vapidPublicKey } from "@/lib/push";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { type DayLesson, lessonsOfDays } from "@/lib/studio-today";
import { LogOutButton } from "./log-out-button";
import { PasskeyOffer } from "./passkey-offer";
import { PushButtons } from "./push-buttons";
import { RenewCalendarButton } from "./renew-calendar-button";
import styles from "./studio.module.css";

// The start page of the studio app: the links to the bookings (#76), the hours (#23), the offers, the questions (#68),
// the classes (#96), the photos (#173) and the news
// note of the home page (#654).
export default async function StudioPage() {
  // The proxy guards each studio page; this check also keeps the data of a page behind the login.
  const requestHeaders = await headers();
  const session = await getStudioSession(requestHeaders);
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioHome");
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");
  const guide = await getTranslations("StudioGuide");
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  // The calendar app of the phone opens a `webcal://` address and polls the feed of #103 by itself.
  const calendarUrl = `webcal://${requestHeaders.get("host")}/api/calendar/${getCalendarToken(getDb())}.ics`;
  // The number of open questions shows Nina at once that a question waits (#130).
  const questionCount = await countNinaQuestions();
  // The count of unanswered contact messages (#533).
  const messageCount = countUnanswered(getDb());
  // The count of the requests that wait for Nina's answer (#659).
  const requestCount = countOpenRequests(getDb());
  // The lessons of today and tomorrow, each one tap from its booking (#661).
  const { today, tomorrow } = lessonsOfDays(getDb());
  const dayList = (title: string, lessons: DayLesson[]) =>
    lessons.length > 0 && (
      <>
        <h2 className={styles.title}>{title}</h2>
        <ul className={styles.list}>
          {lessons.map(({ booking, offer }) => (
            <li key={booking.id} className={styles.item}>
              <Link className={styles.link} href={`/studio/bookings#booking-${booking.id}`}>
                {time.format(booking.start)} · {offerName(offer.kind, { minutes: offer.minutes })} ·{" "}
                {shownName(booking, weekName("removed"))}
              </Link>
            </li>
          ))}
        </ul>
      </>
    );
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("loggedInAs", { email: session.user.email })}</p>
      {/* At the top: a phone with no push shows it in the first screen (#580). One instance: it repairs (#570). */}
      <PushButtons vapidKey={vapidPublicKey()} />
      {/* The search of the bookings from the first screen (#665, epic #662): the same form as the search page (#664). */}
      <form className={styles.form} method="get" action="/studio/search">
        <label className={styles.label}>
          {t("search")}
          <input className={styles.input} type="search" name="q" />
        </label>
        <button className={styles.button} type="submit">
          {t("searchButton")}
        </button>
      </form>
      {dayList(t("today"), today)}
      {dayList(t("tomorrow"), tomorrow)}
      {requestCount === 0 && today.length === 0 && tomorrow.length === 0 && (
        <p className={styles.note}>{t("nothing")}</p>
      )}
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/bookings">
          {requestCount ? t("bookingsCount", { count: requestCount }) : t("bookings")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/search">
          {t("search")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/money">
          {t("money")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/messages">
          {messageCount ? t("messagesCount", { count: messageCount }) : t("messages")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/week">
          {t("week")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/hours">
          {t("hours")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/offers">
          {t("offers")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/news">
          {t("news")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/photos">
          {t("photos")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/classes">
          {t("classes")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/questions">
          {questionCount ? t("questionsCount", { count: questionCount }) : t("questions")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <a className={styles.tile} href={calendarUrl}>
          {t("calendarAdd")}
        </a>
      </p>
      <p className={styles.note}>{t("calendarNote")}</p>
      <RenewCalendarButton />
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/devices">
          {t("devices")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/feedback">
          {t("feedback")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <a className={styles.tile} href={`/${locale}/studio-guide`}>
          {guide("link")}
        </a>
      </p>
      <PasskeyOffer />
      <LogOutButton />
    </main>
  );
}
