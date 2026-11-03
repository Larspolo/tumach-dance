import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Booking } from "@/db/bookings";
import styles from "../studio.module.css";
import { repeat } from "./actions";

/** The weeks that Nina can choose (#679): 2 to 8, default 4 (P1: one good default). */
const WEEKS = [2, 3, 4, 5, 6, 7, 8];

/** The repeat of an approved booking (#679), as the move: tap "Repeat", keep 4 weeks, tap the button. */
export async function RepeatPanel({ booking, weekStart }: { booking: Booking; weekStart: string }) {
  const t = await getTranslations("StudioWeek");
  return (
    <form className={styles.form} action={repeat} data-repeat={booking.id}>
      <input type="hidden" name="id" value={booking.id} />
      <input type="hidden" name="start" value={weekStart} />
      <label>
        {t("repeatWeeks")}{" "}
        <select name="weeks" defaultValue="4">
          {WEEKS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>{" "}
      <button className={styles.button} type="submit">
        {t("repeatYes")}
      </button>{" "}
      <Link className={styles.link} href={`/studio/week?start=${weekStart}`}>
        {t("repeatNo")}
      </Link>
    </form>
  );
}
