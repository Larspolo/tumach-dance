import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import type { Booking } from "@/db/bookings";
import type { Offer } from "@/db/offers";
import { bookingDays } from "@/lib/booking-page";
import { TIME_ZONE } from "@/lib/hours";
import styles from "../studio.module.css";
import { move } from "./actions";

/**
 * The move of a booking (#411) in links, as the cancel of the week page: tap a day, tap a free time, then confirm.
 * The free times are those of the booking page (the next 4 weeks), with the own time of the booking free.
 */
export async function MovePanel({
  booking,
  offer,
  weekStart,
  locale,
  day,
  to,
  taken,
}: {
  booking: Booking;
  offer: Offer;
  weekStart: string;
  locale: string;
  day?: string;
  to?: number;
  taken: boolean;
}) {
  const t = await getTranslations("StudioWeek");
  const base = `/studio/week?start=${weekStart}&move=${booking.id}`;
  const days = bookingDays(getDb(), offer, Date.now(), { except: booking.id }).filter((d) => d.slots.length > 0);
  const dayName = new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });
  const shownDay = (date: string) => dayName.format(new Date(`${date}T12:00:00Z`));
  const chosen = days.find((d) => d.date === day);
  const slot = chosen?.slots.find((s) => s.start === to);
  const close = (
    <Link className={styles.link} href={`/studio/week?start=${weekStart}`}>
      {t("moveNo")}
    </Link>
  );

  if (chosen && slot) {
    return (
      <form className={styles.form} action={move} data-move={booking.id}>
        <input type="hidden" name="id" value={booking.id} />
        <input type="hidden" name="to" value={slot.start} />
        <input type="hidden" name="start" value={weekStart} />
        <span>{t("moveAsk", { day: shownDay(chosen.date), time: time.format(slot.start) })}</span>{" "}
        <button className={styles.button} type="submit">
          {t("moveYes")}
        </button>{" "}
        {close}
      </form>
    );
  }
  return (
    <div data-move={booking.id}>
      {taken && <p className={styles.error}>{t("moveTaken")}</p>}
      {days.length === 0 ? (
        <p className={styles.note}>{t("moveNone")}</p>
      ) : chosen ? (
        <p>
          {t("moveTime", { day: shownDay(chosen.date) })}{" "}
          {chosen.slots.map((s) => (
            <span key={s.start}>
              <Link className={styles.link} href={`${base}&day=${chosen.date}&to=${s.start}`}>
                {time.format(s.start)}
              </Link>{" "}
            </span>
          ))}
        </p>
      ) : (
        <p>
          {t("moveDay")}{" "}
          {days.map((d) => (
            <span key={d.date}>
              <Link className={styles.link} href={`${base}&day=${d.date}`}>
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
