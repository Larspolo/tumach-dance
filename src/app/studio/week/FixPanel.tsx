import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Booking } from "@/db/bookings";
import styles from "../studio.module.css";
import { fix } from "./actions";

/** The correction of the name, email, phone or price (#761) of a booking (#759): the current values, change one, tap "Save". */
export async function FixPanel({ booking, weekStart, wrong }: { booking: Booking; weekStart: string; wrong?: string }) {
  const t = await getTranslations("StudioWeek");
  return (
    <form className={styles.form} action={fix} data-fix={booking.id}>
      <input type="hidden" name="id" value={booking.id} />
      <input type="hidden" name="start" value={weekStart} />
      <label className={styles.label}>
        {t("lessonName")}
        <input
          className={styles.input}
          name="name"
          required
          maxLength={100}
          autoComplete="off"
          defaultValue={booking.name}
        />
      </label>
      <label className={styles.label}>
        {t("lessonEmail")}
        <input
          className={styles.input}
          name="email"
          type="email"
          maxLength={200}
          autoComplete="off"
          defaultValue={booking.email}
        />
      </label>
      <label className={styles.label}>
        {t("lessonPhone")}
        <input
          className={styles.input}
          name="phone"
          type="tel"
          maxLength={40}
          autoComplete="off"
          defaultValue={booking.phone}
        />
      </label>
      <label className={styles.label}>
        {t("fixPrice")}
        <input
          className={styles.input}
          name="price"
          inputMode="decimal"
          required
          pattern="\d+([.,]\d{1,2})?"
          autoComplete="off"
          defaultValue={(booking.priceCents / 100).toFixed(2)}
        />
      </label>
      {wrong === "name" && <p className={styles.error}>{t("fixWrongName")}</p>}
      {wrong === "email" && <p className={styles.error}>{t("fixWrongEmail")}</p>}
      {wrong === "phone" && <p className={styles.error}>{t("fixWrongPhone")}</p>}
      {wrong === "price" && <p className={styles.error}>{t("fixWrongPrice")}</p>}
      <button className={styles.button} type="submit">
        {t("fixSave")}
      </button>{" "}
      <Link className={styles.link} href={`/studio/week?start=${weekStart}`}>
        {t("lessonClose")}
      </Link>
    </form>
  );
}
