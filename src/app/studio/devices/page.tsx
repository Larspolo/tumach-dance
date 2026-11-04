import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getAuth, getStudioSession } from "@/lib/auth";
import { deviceKind } from "@/lib/device-kind";
import { TIME_ZONE } from "@/lib/hours";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { LogOutDevice } from "./log-out-device";

// "Devices" (#585): each device where Nina is logged in, its kind and the day of its last use, newest first.
export default async function DevicesPage() {
  const requestHeaders = await headers();
  const session = await getStudioSession(requestHeaders);
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("Devices");
  const sessions = await getAuth().api.listSessions({ headers: requestHeaders });
  sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  // `updatedAt` renews once a day (`updateAge` in auth.ts): show the day, not the time.
  const day = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, day: "numeric", month: "long", year: "numeric" });
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE });
  const today = dayKey.format(new Date());
  const lastUse = (at: Date) => (dayKey.format(at) === today ? t("today") : day.format(at));
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      <ul className={styles.list}>
        {sessions.map((s) => {
          const kind = deviceKind(s.userAgent ?? null);
          const current = s.token === session.session.token;
          return (
            <li key={s.id} className={styles.item}>
              <p>
                <strong>{t("kind", { type: kind.type, browser: kind.browser })}</strong>
                {current && <> · {t("thisDevice")}</>}
              </p>
              <p className={styles.note}>{t("lastUse", { day: lastUse(new Date(s.updatedAt)) })}</p>
              {!current && <LogOutDevice token={s.token} />}
            </li>
          );
        })}
      </ul>
      {sessions.length > 1 && <LogOutDevice />}
    </main>
  );
}
