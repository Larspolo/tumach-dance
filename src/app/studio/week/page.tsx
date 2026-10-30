import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listBookings } from "@/db/bookings";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/hours";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { localDate, weekOf } from "@/lib/week";
import styles from "../studio.module.css";
import { cancel } from "./actions";

// The bookings of a week, per day (#102): the requests and the approved bookings, Monday to Sunday.
export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; cancel?: string }>;
}) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioWeek");
  const offerName = await getTranslations("StudioOffers");
  const params = await searchParams;
  const week = weekOf(params.start);
  // The first tap on "Cancel" asks again; only "Yes, cancel" cancels (#162).
  const asked = Number(params.cancel);
  const bookings = listBookings(getDb(), week.from, week.to, ["requested", "approved"]);
  const dayName = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      <p>
        <Link className={styles.link} href={`/studio/week?start=${week.previous}`}>
          {t("previous")}
        </Link>{" "}
        ·{" "}
        <Link className={styles.link} href={`/studio/week?start=${week.next}`}>
          {t("next")}
        </Link>
      </p>
      {week.days.map((day) => {
        const ofDay = bookings.filter(({ booking }) => localDate(booking.start) === day);
        return (
          <section key={day} className={styles.item} data-day={day}>
            <h2 className={styles.label}>{dayName.format(new Date(`${day}T12:00:00Z`))}</h2>
            {ofDay.length === 0 && <p className={styles.note}>{t("free")}</p>}
            <ul className={styles.list}>
              {ofDay.map(({ booking, offer }) => (
                <li key={booking.id}>
                  {time.format(booking.start)} {offerName(offer.kind, { minutes: offer.minutes })}, {booking.name}{" "}
                  {booking.status === "requested" ? (
                    <Link className={styles.link} href="/studio/bookings">
                      {t("request")}
                    </Link>
                  ) : (
                    <span className={styles.mark}>{t(booking.paidAt === null ? "approved" : "paid")}</span>
                  )}{" "}
                  {booking.id === asked ? (
                    <form className={styles.form} action={cancel}>
                      <input type="hidden" name="id" value={booking.id} />
                      <input type="hidden" name="start" value={week.start} />
                      <span>{t("cancelAsk")}</span>{" "}
                      <button className={styles.button} type="submit">
                        {t("cancelYes")}
                      </button>{" "}
                      <Link className={styles.link} href={`/studio/week?start=${week.start}`}>
                        {t("cancelNo")}
                      </Link>
                    </form>
                  ) : (
                    <Link className={styles.link} href={`/studio/week?start=${week.start}&cancel=${booking.id}`}>
                      {t("cancel")}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
