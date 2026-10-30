import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { getCalendarToken } from "@/lib/calendar-token";
import { countNinaQuestions } from "@/lib/github";
import { vapidPublicKey } from "@/lib/push";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { LogOutButton } from "./log-out-button";
import { PasskeyOffer } from "./passkey-offer";
import { PushButtons } from "./push-buttons";
import { RenewCalendarButton } from "./renew-calendar-button";
import styles from "./studio.module.css";

// The start page of the studio app: the links to the bookings (#76), the hours (#23), the offers, the questions (#68)
// and the classes (#96).
export default async function StudioPage() {
  // The proxy guards each studio page; this check also keeps the data of a page behind the login.
  const requestHeaders = await headers();
  const session = await getStudioSession(requestHeaders);
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioHome");
  // The calendar app of the phone opens a `webcal://` address and polls the feed of #103 by itself.
  const calendarUrl = `webcal://${requestHeaders.get("host")}/api/calendar/${getCalendarToken(getDb())}.ics`;
  // The number of open questions shows Nina at once that a question waits (#130).
  const questionCount = await countNinaQuestions();
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("loggedInAs", { email: session.user.email })}</p>
      <PasskeyOffer />
      <p>
        <Link className={styles.link} href="/studio/bookings">
          {t("bookings")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/week">
          {t("week")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/hours">
          {t("hours")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/offers">
          {t("offers")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/classes">
          {t("classes")}
        </Link>
      </p>
      <p>
        <Link className={styles.link} href="/studio/questions">
          {questionCount ? t("questionsCount", { count: questionCount }) : t("questions")}
        </Link>
      </p>
      <p>
        <a className={styles.link} href={calendarUrl}>
          {t("calendarAdd")}
        </a>
      </p>
      <p className={styles.note}>{t("calendarNote")}</p>
      <RenewCalendarButton />
      <PushButtons vapidKey={vapidPublicKey()} />
      <LogOutButton />
    </main>
  );
}
