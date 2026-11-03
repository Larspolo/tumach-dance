import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/db";
import { routing } from "@/i18n/routing";
import { moveLink } from "@/lib/booking-move-dancer";
import { bookingDays } from "@/lib/booking-page";
import { TIME_ZONE } from "@/lib/hours";
import styles from "../../book/book.module.css";
import { moveWithLink } from "./actions";

// The move of a waiting request by the dancer (#648), in links as the move of Nina (`MovePanel.tsx`): tap a day, tap
// a free time, then confirm. Opening the page (GET) changes nothing: the button posts the server action.
export const dynamic = "force-dynamic";

// The token is in the address: no search engine and no referrer gets it.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("move.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type Search = { token?: string; done?: string; taken?: string; day?: string; to?: string };

export default async function MovePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const { token = "", done, taken, day, to } = await searchParams;
  const t = await getTranslations("MoveBooking");
  const tCancel = await getTranslations("CancelBooking");
  const tBook = await getTranslations("Book");
  const db = getDb();
  const link = moveLink(db, token);

  const contact = (
    <p className={`${styles.note} ${styles.step}`}>
      {tCancel("contactText")}{" "}
      <a className={styles.link} href={`/${locale}#contact`}>
        {tCancel("contact")}
      </a>
    </p>
  );

  if (link.state === "not-found") {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.error} role="status">
          {tCancel("notFound")}
        </p>
        {contact}
      </main>
    );
  }

  const { booking, offer } = link;
  const when = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" });
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const shownDay = (date: string) => dayName.format(new Date(`${date}T12:00:00Z`));
  const base = `/${locale}/booking/move?${new URLSearchParams({ token })}`;
  const cancelPath = `/${locale}/booking/cancel?${new URLSearchParams({ token })}`;
  const header = (
    <>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>
        {t("booking", {
          offer: tBook(offer.kind, { minutes: offer.minutes }),
          when: when.format(new Date(booking.start)),
        })}
      </p>
    </>
  );

  if (link.state !== "open") {
    const message = link.state === "approved" ? t("approved") : tCancel(link.state);
    return (
      <main className={styles.main}>
        {header}
        <p className={done ? styles.note : styles.error} role="status">
          {done ? t("done") : message}
        </p>
        {contact}
      </main>
    );
  }

  const days = bookingDays(db, offer, Date.now(), { except: booking.id }).filter((d) => d.slots.length > 0);
  const chosen = days.find((d) => d.date === day);
  const slot = chosen?.slots.find((s) => s.start === Number(to));
  let body: React.ReactNode;
  if (done) {
    body = (
      <p className={styles.note} role="status">
        {t("done")}
      </p>
    );
  } else if (chosen && slot) {
    body = (
      <form className={styles.form} action={moveWithLink}>
        <input type="hidden" name="token" value={token} />
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="to" value={slot.start} />
        <p>{t("ask", { day: shownDay(chosen.date), time: time.format(slot.start) })}</p>
        <button className={styles.button} type="submit">
          {t("yes")}
        </button>
        <Link className={styles.link} href={`${base}&day=${chosen.date}`}>
          {t("back")}
        </Link>
      </form>
    );
  } else if (days.length === 0) {
    body = <p className={styles.note}>{t("none")}</p>;
  } else if (chosen) {
    body = (
      <>
        <p className={styles.step}>{t("time", { day: shownDay(chosen.date) })}</p>
        <div className={styles.days}>
          {chosen.slots.map((s) => (
            <Link key={s.start} className={styles.choice} href={`${base}&day=${chosen.date}&to=${s.start}`}>
              {time.format(s.start)}
            </Link>
          ))}
        </div>
        <Link className={styles.link} href={base}>
          {t("otherDay")}
        </Link>
      </>
    );
  } else {
    body = (
      <>
        <p className={styles.step}>{t("day")}</p>
        <div className={styles.days}>
          {days.map((d) => (
            <Link key={d.date} className={styles.choice} href={`${base}&day=${d.date}`}>
              {shownDay(d.date)}
            </Link>
          ))}
        </div>
      </>
    );
  }

  return (
    <main className={styles.main}>
      {header}
      {taken && !done && (
        <p className={styles.error} role="status">
          {t("taken")}
        </p>
      )}
      {body}
      {!done && (
        <Link className={styles.link} href={cancelPath}>
          {t("back")}
        </Link>
      )}
      {contact}
    </main>
  );
}
