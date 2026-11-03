import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { shownName } from "@/lib/booking-name";
import { searchBookings } from "@/lib/booking-search";
import { TIME_ZONE } from "@/lib/hours";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { localDate } from "@/lib/week";
import styles from "../studio.module.css";

// The search of the bookings by a part of a name, an email or a phone (#664, epic #662). A plain GET form: it works
// with no JavaScript.
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioSearch");
  const dancerT = await getTranslations("StudioDancer");
  const offerName = await getTranslations("StudioOffers");
  const weekName = await getTranslations("StudioWeek");
  const q = (await searchParams).q?.trim() ?? "";
  const found = q ? searchBookings(getDb(), q) : [];
  const back = `/studio/search?q=${encodeURIComponent(q)}`;
  const when = new Intl.DateTimeFormat(locale, {
    timeZone: TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      <form className={styles.form} method="get" action="/studio/search">
        <label className={styles.label}>
          {t("label")}
          <input className={styles.input} type="search" name="q" defaultValue={q} />
        </label>
        <button className={styles.button} type="submit">
          {t("button")}
        </button>
      </form>
      {q && found.length === 0 && <p className={styles.note}>{t("none")}</p>}
      {found.length > 0 && (
        <ul className={styles.list} data-testid="search-bookings">
          {found.map(({ booking, offer }) => {
            const open = booking.status === "requested" || booking.status === "approved";
            const href = open
              ? `/studio/week?start=${localDate(booking.start)}#booking-${booking.id}`
              : `/studio/dancer/${booking.id}?back=${encodeURIComponent(back)}`;
            return (
              <li key={booking.id} className={styles.item} data-booking={booking.id}>
                <Link className={styles.link} href={href}>
                  <strong>{shownName(booking, weekName("removed"))}</strong>
                </Link>
                <p>
                  {offerName(offer.kind, { minutes: offer.minutes })}, {when.format(booking.start)}
                </p>
                <p>
                  <span className={styles.mark}>{dancerT(`status.${booking.status}`)}</span>{" "}
                  {booking.status === "approved" && (
                    <span className={styles.mark}>{dancerT(booking.paidAt === null ? "notPaid" : "paid")}</span>
                  )}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
