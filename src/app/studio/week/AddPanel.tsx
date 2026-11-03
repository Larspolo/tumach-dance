import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { listOffers } from "@/db/offers";
import { bookingDays } from "@/lib/booking-page";
import { TIME_ZONE } from "@/lib/hours";
import styles from "../studio.module.css";
import { addLesson } from "./actions";

/**
 * Add a lesson that Nina agreed by WhatsApp or phone (#619), in the pattern of `MovePanel` (#411): tap the offer, a
 * day, a free time (those of the booking page), then a short form with the name, the email, the phone and the language.
 */
export async function AddPanel({
  weekStart,
  locale,
  offerId,
  day,
  to,
  taken,
  wrong,
}: {
  weekStart: string;
  locale: string;
  offerId?: number;
  day?: string;
  to?: number;
  taken: boolean;
  wrong: boolean;
}) {
  const t = await getTranslations("StudioWeek");
  const offerName = await getTranslations("StudioOffers");
  const db = getDb();
  // Also a hidden offer: Nina can agree any lesson (#617).
  const offers = listOffers(db);
  const offer = offers.find((o) => o.id === offerId);
  const base = `/studio/week?start=${weekStart}&lesson=1`;
  const euro = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const shownDay = (date: string) => dayName.format(new Date(`${date}T12:00:00Z`));
  const close = (
    <Link className={styles.link} href={`/studio/week?start=${weekStart}`}>
      {t("lessonClose")}
    </Link>
  );

  if (!offer) {
    return (
      <div className={styles.section} data-lesson>
        <p>
          {t("lessonOffer")}{" "}
          {offers.map((o) => (
            <span key={o.id}>
              <Link className={styles.link} href={`${base}&offer=${o.id}`}>
                {offerName(o.kind, { minutes: o.minutes })} {euro.format(o.priceCents / 100)}
              </Link>{" "}
            </span>
          ))}
        </p>
        {close}
      </div>
    );
  }
  const days = bookingDays(db, offer).filter((d) => d.slots.length > 0);
  const chosen = days.find((d) => d.date === day);
  const slot = chosen?.slots.find((s) => s.start === to);
  const offerBase = `${base}&offer=${offer.id}`;

  if (chosen && slot) {
    return (
      <form className={`${styles.form} ${styles.section}`} action={addLesson} data-lesson>
        <input type="hidden" name="offerId" value={offer.id} />
        <input type="hidden" name="to" value={slot.start} />
        <input type="hidden" name="day" value={chosen.date} />
        <input type="hidden" name="start" value={weekStart} />
        <p>
          {t("lessonWhen", {
            offer: offerName(offer.kind, { minutes: offer.minutes }),
            day: shownDay(chosen.date),
            time: time.format(slot.start),
          })}
        </p>
        <label className={styles.label}>
          {t("lessonName")}
          <input className={styles.input} name="name" required maxLength={100} autoComplete="off" />
        </label>
        <label className={styles.label}>
          {t("lessonEmail")}
          <input className={styles.input} name="email" type="email" maxLength={200} autoComplete="off" />
        </label>
        <label className={styles.label}>
          {t("lessonPhone")}
          <input className={styles.input} name="phone" type="tel" maxLength={40} autoComplete="off" />
        </label>
        <label className={styles.label}>
          {t("lessonLanguage")}
          <select className={styles.input} name="locale" defaultValue={locale}>
            <option value="en">{t("lessonEnglish")}</option>
            <option value="nl">{t("lessonDutch")}</option>
          </select>
        </label>
        {wrong && <p className={styles.error}>{t("lessonWrong")}</p>}
        <button className={styles.button} type="submit">
          {t("lessonSave")}
        </button>{" "}
        {close}
      </form>
    );
  }
  return (
    <div className={styles.section} data-lesson>
      {taken && <p className={styles.error}>{t("moveTaken")}</p>}
      {days.length === 0 ? (
        <p className={styles.note}>{t("moveNone")}</p>
      ) : chosen ? (
        <p>
          {t("moveTime", { day: shownDay(chosen.date) })}{" "}
          {chosen.slots.map((s) => (
            <span key={s.start}>
              <Link className={styles.link} href={`${offerBase}&day=${chosen.date}&to=${s.start}`}>
                {time.format(s.start)}
              </Link>{" "}
            </span>
          ))}
        </p>
      ) : (
        <p>
          {t("lessonDay")}{" "}
          {days.map((d) => (
            <span key={d.date}>
              <Link className={styles.link} href={`${offerBase}&day=${d.date}`}>
                {shownDay(d.date)}
              </Link>{" "}
            </span>
          ))}
        </p>
      )}
      {close}
    </div>
  );
}
