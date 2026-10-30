import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/db";
import { listOffers, type Offer } from "@/db/offers";
import { bookingDays } from "@/lib/booking-page";
import { TIME_ZONE } from "@/lib/hours";
import { sendRequest } from "./actions";
import styles from "./book.module.css";

// The booking page (#36): offer → day → time → the form → "request sent". Each step is a link with search
// params, so the page works on a phone with no JavaScript; the form is a plain HTML form and a server action.
export const dynamic = "force-dynamic";

type Search = { offer?: string; day?: string; start?: string; error?: string; sent?: string };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const search = await searchParams;
  const t = await getTranslations("Book");
  const href = (change: Search) => `/${locale}/book?${new URLSearchParams(change as Record<string, string>)}`;

  if (search.sent) {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>{t("sent")}</h1>
        <p className={styles.note}>{t("sentText")}</p>
        <a className={styles.link} href={`/${locale}/book`}>
          {t("again")}
        </a>
      </main>
    );
  }

  const db = getDb();
  const offers = listOffers(db, { visibleOnly: true });
  const offer = offers.find((o) => String(o.id) === search.offer);
  const days = offer ? bookingDays(db, offer) : [];
  const day = days.find((d) => d.date === search.day && d.slots.length > 0);
  const slot = day?.slots.find((s) => String(s.start) === search.start);

  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const offerName = (o: Offer) => `${t(o.kind, { minutes: o.minutes })} · ${euro.format(o.priceCents / 100)}`;
  const dateOf = (date: string) => dayName.format(new Date(`${date}T12:00:00Z`));
  const error = search.error && ["taken", "invalid", "notSlot"].includes(search.error) ? search.error : undefined;

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      {error && (
        <p className={styles.error} role="status">
          {t(error as "taken" | "invalid" | "notSlot")}
        </p>
      )}

      <section className={styles.step}>
        <h2 className={styles.heading}>{t("offer")}</h2>
        {offers.length === 0 && <p className={styles.note}>{t("noOffers")}</p>}
        <div className={styles.choices}>
          {offers.map((o) => (
            <a
              key={o.id}
              className={o === offer ? styles.chosen : styles.choice}
              aria-current={o === offer ? "true" : undefined}
              href={href({ offer: String(o.id) })}
            >
              {offerName(o)}
            </a>
          ))}
        </div>
      </section>

      {offer && (
        <section className={styles.step}>
          <h2 className={styles.heading}>{t("day")}</h2>
          {days.every((d) => d.slots.length === 0) && <p className={styles.note}>{t("noTimes")}</p>}
          <div className={styles.days}>
            {days.map((d) =>
              d.slots.length === 0 ? (
                <span key={d.date} className={styles.disabled} aria-disabled="true">
                  {dateOf(d.date)}
                </span>
              ) : (
                <a
                  key={d.date}
                  className={d === day ? styles.chosen : styles.choice}
                  aria-current={d === day ? "true" : undefined}
                  href={href({ offer: String(offer.id), day: d.date })}
                >
                  {dateOf(d.date)}
                </a>
              ),
            )}
          </div>
        </section>
      )}

      {offer && day && (
        <section className={styles.step}>
          <h2 className={styles.heading}>{t("time")}</h2>
          <div className={styles.days}>
            {day.slots.map((s) => (
              <a
                key={s.start}
                className={s === slot ? styles.chosen : styles.choice}
                aria-current={s === slot ? "true" : undefined}
                href={href({ offer: String(offer.id), day: day.date, start: String(s.start) })}
              >
                {time.format(s.start)}
              </a>
            ))}
          </div>
        </section>
      )}

      {offer && day && slot && (
        <section className={styles.step}>
          <h2 className={styles.heading}>{t("details")}</h2>
          <p className={styles.note}>
            {offerName(offer)} · {dateOf(day.date)} · {time.format(slot.start)}
          </p>
          <form className={styles.form} action={sendRequest}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="offerId" value={offer.id} />
            <input type="hidden" name="day" value={day.date} />
            <input type="hidden" name="start" value={slot.start} />
            <input type="hidden" name="end" value={slot.end} />
            <label className={styles.field}>
              <span>{t("name")}</span>
              <input className={styles.input} name="name" required maxLength={100} autoComplete="name" />
            </label>
            <label className={styles.field}>
              <span>{t("email")}</span>
              <input className={styles.input} name="email" type="email" required maxLength={200} autoComplete="email" />
            </label>
            <label className={styles.field}>
              <span>{t("phone")}</span>
              <input className={styles.input} name="phone" type="tel" required autoComplete="tel" />
            </label>
            <button className={styles.button} type="submit">
              {t("send")}
            </button>
          </form>
        </section>
      )}
    </main>
  );
}
