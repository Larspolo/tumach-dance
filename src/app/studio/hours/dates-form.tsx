"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import styles from "../studio.module.css";
import { closeDates, openExtraDay } from "./actions";

// The forms to close dates and to open an extra day (#24): native date inputs (P3) and a Server Action each.
export function CloseForm() {
  const t = useTranslations("StudioHours");
  const [state, action, pending] = useActionState(closeDates, "idle");
  return (
    <form action={action} className={styles.form} aria-label={t("closedDates")}>
      {state !== "idle" && <p className={styles.error}>{t(state)}</p>}
      <label className={styles.choice}>
        {t("closedFrom")}
        <input className={styles.time} type="date" name="closedFrom" required />
      </label>
      <label className={styles.choice}>
        {t("closedTo")}
        <input className={styles.time} type="date" name="closedTo" />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t("close")}
      </button>
    </form>
  );
}

export function ExtraOpenForm() {
  const t = useTranslations("StudioHours");
  const [state, action, pending] = useActionState(openExtraDay, "idle");
  return (
    <form action={action} className={styles.form} aria-label={t("extraDays")}>
      {state !== "idle" && <p className={styles.error}>{t(state)}</p>}
      <label className={styles.choice}>
        {t("extraDate")}
        <input className={styles.time} type="date" name="extraDate" required />
      </label>
      {(["allDay", "from"] as const).map((mode) => (
        <label key={mode} className={styles.choice}>
          <input type="radio" name="extraMode" value={mode} defaultChecked={mode === "allDay"} />
          {t(mode)}
        </label>
      ))}
      <label className={styles.choice}>
        {t("fromTime")}
        <input className={styles.time} type="time" name="extraFrom" defaultValue="17:00" />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t("openDay")}
      </button>
    </form>
  );
}
