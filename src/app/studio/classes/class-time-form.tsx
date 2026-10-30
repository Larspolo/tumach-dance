"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { CLASS_WEEKDAYS } from "@/lib/class-time-form";
import styles from "../studio.module.css";
import { changeClassTime } from "./actions";

// Add a weekly time to a class (#97): a weekday select and the time pickers of the browser (P3).
export function ClassTimeForm({ classId }: { classId: number }) {
  const t = useTranslations("StudioClasses");
  const [state, action, pending] = useActionState(changeClassTime, { result: "none" });
  return (
    <form key={JSON.stringify(state)} className={styles.form} action={action}>
      <input type="hidden" name="classId" value={classId} />
      {state.result === "wrong" && <p className={styles.error}>{t("wrongTime")}</p>}
      <label className={styles.form}>
        <span className={styles.label}>{t("weekday")}</span>
        <select className={styles.input} name="weekday" defaultValue={state.weekday ?? "mon"}>
          {CLASS_WEEKDAYS.map((d) => (
            <option key={d} value={d}>
              {t(`day.${d}`)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.choice}>
        {t("start")}
        <input className={styles.time} type="time" name="from" required defaultValue={state.from ?? "18:00"} />
      </label>
      <label className={styles.choice}>
        {t("end")}
        <input className={styles.time} type="time" name="to" required defaultValue={state.to ?? "19:00"} />
      </label>
      <button className={styles.button} type="submit" name="intent" value="addTime" disabled={pending}>
        {t("addTime")}
      </button>
    </form>
  );
}
