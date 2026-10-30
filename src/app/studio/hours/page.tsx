import { DateTime } from "luxon";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { openRanges, TIME_ZONE } from "@/lib/hours";
import { ruleToForm } from "@/lib/hours-form";
import { getHoursRule } from "@/lib/hours-store";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { HoursForm } from "./hours-form";

// "Hours" (#23): Nina's weekly rule in two groups, and the open times of the next 7 days below it.
export default async function HoursPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioHours");
  const rule = getHoursRule(getDb());
  const form = ruleToForm(rule);

  const today = DateTime.now().setZone(TIME_ZONE).startOf("day");
  const ranges = openRanges(rule, today.toISODate() ?? "", today.plus({ days: 6 }).toISODate() ?? "");
  const day = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <HoursForm form={form} />
      <h2 className={styles.label}>{t("nextWeek")}</h2>
      <ul className={styles.list} aria-label={t("nextWeek")}>
        {ranges.length === 0 && <li>{t("noOpenTimes")}</li>}
        {ranges.map((r) => (
          <li key={r.start}>
            {day.format(r.start)}: {time.format(r.start)}–{time.format(r.end)}
          </li>
        ))}
      </ul>
    </main>
  );
}
