import { DateTime } from "luxon";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listOffers } from "@/db/offers";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName } from "@/lib/booking-name";
import { bookingsOutsideHours } from "@/lib/bookings-outside-hours";
import { openRanges, TIME_ZONE } from "@/lib/hours";
import { type DateKind, dateKey, upcoming } from "@/lib/hours-dates";
import { ruleToForm } from "@/lib/hours-form";
import { getHoursRule } from "@/lib/hours-store";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { localDate } from "@/lib/week";
import styles from "../studio.module.css";
import { cancelOutside, removeHoursDate } from "./actions";
import { CloseForm, ExtraOpenForm } from "./dates-form";
import { HoursForm } from "./hours-form";

// "Hours" (#23): Nina's weekly rule in two groups, her closed and extra open dates (#24), and the open times of the
// next 7 days below them.
export default async function HoursPage({
  searchParams,
}: {
  searchParams: Promise<{ cancelOutside?: string; outsideCancelled?: string }>;
}) {
  const params = await searchParams;
  const outsideCancelled = Number(params.outsideCancelled);
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioHours");
  const rule = getHoursRule(getDb());
  const form = ruleToForm(rule);
  // The coming bookings outside the open hours (#713): shown each time the page opens while they exist.
  const outside = bookingsOutsideHours(getDb(), rule);
  const offers = new Map(listOffers(getDb()).map((o) => [o.id, o]));
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");

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
      {params.outsideCancelled !== undefined && Number.isInteger(outsideCancelled) && (
        <p className={styles.note} data-outside-cancelled>
          {t("outsideCancelled", { count: outsideCancelled })}
        </p>
      )}
      {outside.length > 0 && (
        <section aria-label={t("outsideTitle")}>
          <h2 className={styles.label}>{t("outsideTitle")}</h2>
          <p>{t("outsideWhy")}</p>
          <ul className={styles.list} aria-label={t("outsideWhy")}>
            {outside.map((b) => {
              const offer = offers.get(b.offerId);
              return (
                <li key={b.id}>
                  <Link className={styles.link} href={`/studio/week?start=${localDate(b.start)}#booking-${b.id}`}>
                    {day.format(b.start)} · {time.format(b.start)}
                    {offer ? ` · ${offerName(offer.kind, { minutes: offer.minutes })}` : ""} ·{" "}
                    {shownName(b, weekName("removed"))}
                  </Link>
                </li>
              );
            })}
          </ul>
          {params.cancelOutside === "1" ? (
            <form className={styles.form} action={cancelOutside} data-cancel-outside>
              <span>{t("outsideAsk", { count: outside.length })}</span>{" "}
              <button className={styles.button} type="submit">
                {t("outsideYes")}
              </button>{" "}
              <Link className={styles.link} href="/studio/hours">
                {t("outsideNo")}
              </Link>
            </form>
          ) : (
            <p>
              <Link className={styles.link} href="/studio/hours?cancelOutside=1">
                {t("outsideCancel")}
              </Link>
            </p>
          )}
        </section>
      )}
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
