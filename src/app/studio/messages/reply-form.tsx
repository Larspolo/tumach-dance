"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import styles from "../studio.module.css";
import { type ReplyState, sendReply } from "./actions";

// The answer of Nina to one contact message (#533): one text box and one Server Action.
export function ReplyForm({ id }: { id: number }) {
  const t = useTranslations("StudioMessages");
  const [state, action, pending] = useActionState<ReplyState, FormData>(sendReply, { error: false, text: "" });
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="id" value={id} />
      <label className={styles.form}>
        <span className={styles.label}>{t("answer")}</span>
        <textarea className={styles.input} name="text" rows={5} required maxLength={5000} defaultValue={state.text} />
      </label>
      {state.empty && (
        <p className={styles.error} role="status">
          {t("empty")}
        </p>
      )}
      {state.error && (
        <p className={styles.error} role="status">
          {t("error")}
        </p>
      )}
      <button className={styles.button} type="submit" disabled={pending}>
        {t("send")}
      </button>
    </form>
  );
}
