import { DateTime } from "luxon";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { openRanges, TIME_ZONE } from "@/lib/hours";
import { type DateKind, dateKey, upcoming } from "@/lib/hours-dates";
import { ruleToForm } from "@/lib/hours-form";
import { getHoursRule } from "@/lib/hours-store";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { removeHoursDate } from "./actions";
import { CloseForm, ExtraOpenForm } from "./dates-form";
import { HoursForm } from "./hours-form";

// "Hours" (#23): Nina's weekly rule in two groups, her closed and extra open dates (#24), and the open times of the
// next 7 days below them.
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

  const dates = upcoming(rule, today.toISODate() ?? "");
  const date = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
  const showDate = (iso: string) => date.format(new Date(`${iso}T12:00:00Z`));
  const removeButton = (kind: DateKind, key: string, name: string) => (
    <form action={removeHoursDate}>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={key} />
      <button className={styles.link} type="submit" aria-label={`${t("remove")}: ${name}`}>
        {t("remove")}
      </button>
    </form>
  );

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <HoursForm form={form} />
      <h2 className={styles.label}>{t("closedDates")}</h2>
      <ul className={styles.list} aria-label={t("closedDates")}>
        {dates.closed.length === 0 && <li>{t("none")}</li>}
        {dates.closed.map((c) => {
          const name = c.to ? `${showDate(c.from)} – ${showDate(c.to)}` : showDate(c.from);
          return (
            <li key={dateKey(c)} className={styles.summary}>
              <span>{name}</span>
              {removeButton("closed", dateKey(c), name)}
            </li>
          );
        })}
      </ul>
      <CloseForm />
      <h2 className={styles.label}>{t("extraDays")}</h2>
      <ul className={styles.list} aria-label={t("extraDays")}>
        {dates.extraOpen.length === 0 && <li>{t("none")}</li>}
        {dates.extraOpen.map((e) => {
          const hours = e.hours === "allDay" ? t("allDayShort") : t("fromShort", { time: e.hours.from });
          const name = `${showDate(e.date)}, ${hours}`;
          return (
            <li key={dateKey(e)} className={styles.summary}>
              <span>{name}</span>
              {removeButton("extra", dateKey(e), name)}
            </li>
          );
        })}
      </ul>
      <ExtraOpenForm />
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
