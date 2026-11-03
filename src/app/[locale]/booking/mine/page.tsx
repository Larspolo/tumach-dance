import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/db";
import { routing } from "@/i18n/routing";
import { mineBookings } from "@/lib/booking-mine";
import { TIME_ZONE } from "@/lib/hours";
import styles from "../../book/book.module.css";

// The next bookings of a dancer (#743), from the token of one booking. It only shows: each row links to the cancel
// page of its booking, which checks the token again.
export const dynamic = "force-dynamic";

// The token is in the address: no search engine and no referrer gets it.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("mine.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function MinePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token = "" } = await searchParams;
  const t = await getTranslations("MyBookings");
  const tBook = await getTranslations("Book");
  const rows = mineBookings(getDb(), token);
  const when = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" });

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      {rows.length === 0 ? (
        <>
          <p className={styles.note} role="status">
            {t("none")}
          </p>
          <a className={styles.link} href={`/${locale}/book`}>
            {t("book")}
          </a>
        </>
      ) : (
        <ul className={styles.step}>
          {rows.map(({ booking, offer }) => (
            <li key={booking.id} className={styles.note}>
              <strong>{when.format(new Date(booking.start))}</strong>
              <br />
              {tBook(offer.kind, { minutes: offer.minutes })} · {t(booking.status as "requested" | "approved")}
              <br />
              <a
                className={styles.link}
                href={`/${locale}/booking/cancel?${new URLSearchParams({ token: booking.cancelToken })}`}
              >
                {t("cancel")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
