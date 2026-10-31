"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import styles from "../studio.module.css";
import { type FeedbackState, sendFeedback } from "./actions";

// One text box and one button (#108). After a failure the text stays in the box; after a send the box is empty.
export function FeedbackForm({ max }: { max: number }) {
  const t = useTranslations("StudioFeedback");
  const [state, action, pending] = useActionState<FeedbackState, FormData>(sendFeedback, { status: "idle", text: "" });
  return (
    <form action={action} className={styles.form}>
      {state.status === "sent" && <p className={styles.note}>{t("thanks")}</p>}
      {state.status === "failed" && <p className={styles.error}>{t("failed")}</p>}
      <label className={styles.form}>
        <span className={styles.label}>{t("label")}</span>
        <textarea
          key={`${state.status}-${state.text.length}`}
          className={styles.input}
          name="text"
          rows={8}
          required
          maxLength={max}
          defaultValue={state.text}
        />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {t("send")}
      </button>
    </form>
  );
}
