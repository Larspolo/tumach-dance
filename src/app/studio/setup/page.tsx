import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { getCalendarToken } from "@/lib/calendar-token";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { RenewCalendarButton } from "../renew-calendar-button";
import styles from "../studio.module.css";

// The setup of the studio (Nina, #838): hours, offers, photos, classes and the calendar, one tap from the home.
export default async function SetupPage() {
  const requestHeaders = await headers();
  const session = await getStudioSession(requestHeaders);
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioHome");
  // The calendar app of the phone opens a `webcal://` address and polls the feed of #103 by itself.
  const calendarUrl = `webcal://${requestHeaders.get("host")}/api/calendar/${getCalendarToken(getDb())}.ics`;
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("setup")}</h1>
      {(["hours", "offers", "photos", "classes"] as const).map((key) => (
        <p key={key} className={styles.tileRow}>
          <Link className={styles.tile} href={`/studio/${key}`}>
            {t(key)}
          </Link>
        </p>
      ))}
      <p className={styles.tileRow}>
        <a className={styles.tile} href={calendarUrl}>
          {t("calendarAdd")}
        </a>
      </p>
      <p className={styles.note}>{t("calendarNote")}</p>
      <RenewCalendarButton />
    </main>
  );
}
