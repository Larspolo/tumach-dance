"use client";
import { useTranslations } from "next-intl";
import { useActionState } from "react";
import type { NinaQuestion } from "@/lib/nina-question";
import styles from "../studio.module.css";
import { type AnswerState, sendAnswer } from "./actions";

// The answer of Nina to one question (#68): native radio buttons and a text box, one Server Action (P3).
export function AnswerForm({ question }: { question: NinaQuestion }) {
  const t = useTranslations("StudioQuestions");
  const [state, action, pending] = useActionState<AnswerState, FormData>(sendAnswer, {
    error: false,
    choice: null,
    text: "",
  });
  return (
    <form action={action} className={styles.form}>
      <input type="hidden" name="number" value={question.number} />
      {question.choices.length > 0 && (
        <fieldset className={styles.choices}>
          <legend className={styles.label}>{t("choose")}</legend>
          {question.choices.map((choice) => (
            <label key={choice.key} className={styles.choice}>
              <input
                type="radio"
                name="choice"
                value={choice.key}
                required
                defaultChecked={state.choice === choice.key}
              />
              {choice.text}
            </label>
          ))}
        </fieldset>
      )}
      <label className={styles.form}>
        <span className={styles.label}>{t("text")}</span>
        <textarea className={styles.input} name="text" rows={3} defaultValue={state.text} />
      </label>
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
