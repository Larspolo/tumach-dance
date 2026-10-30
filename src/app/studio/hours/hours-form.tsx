"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { type HoursForm as Form, type Group, WEEKDAYS } from "@/lib/hours-form";
import styles from "../studio.module.css";
import { saveHours } from "./actions";

// The form of the hours (#23): native inputs and a Server Action (P3); `useActionState` shows the result.
export function HoursForm({ form }: { form: Form }) {
  const t = useTranslations("StudioHours");
  const [state, action, pending] = useActionState(saveHours, "idle");

  const groupFields = (name: "weekdays" | "weekend", group: Group) => (
    <>
      {(["closed", "allDay", "from"] as const).map((mode) => (
        <label key={mode} className={styles.choice}>
          <input type="radio" name={`${name}Mode`} value={mode} defaultChecked={group.mode === mode} />
          {t(mode)}
        </label>
      ))}
      <label className={styles.choice}>
        {t("fromTime")}
        <input className={styles.time} type="time" name={`${name}From`} defaultValue={group.from} />
      </label>
    </>
  );

  return (
    <form action={action} className={styles.form}>
      {state === "saved" && <p className={styles.note}>{t("saved")}</p>}
      {state === "wrong" && <p className={styles.error}>{t("wrong")}</p>}
      <fieldset className={styles.group}>
        <legend className={styles.label}>{t("weekdays")}</legend>
        {groupFields("weekdays", form.weekdays)}
        <div className={styles.days}>
          {WEEKDAYS.map((d) => (
            <label key={d} className={styles.day}>
              <input type="checkbox" name={`day-${d}`} defaultChecked={form.weekdays.days.includes(d)} />
              {t(`day.${d}`)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset className={styles.group}>
        <legend className={styles.label}>{t("weekend")}</legend>
        {groupFields("weekend", form.weekend)}
      </fieldset>
      <button className={styles.button} type="submit" disabled={pending}>
        {t("save")}
      </button>
    </form>
  );
}
