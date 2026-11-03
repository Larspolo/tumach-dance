"use client";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { NEWS_MAX } from "@/lib/news-note";
import styles from "../studio.module.css";

/** The text of the note with the count of the characters left (#654). */
export function NewsText({ initial }: { initial: string }) {
  const t = useTranslations("StudioNews");
  const [text, setText] = useState(initial);
  return (
    <>
      <label className={styles.label} htmlFor="news-text">
        {t("text")}
      </label>
      <textarea
        id="news-text"
        name="text"
        className={styles.input}
        rows={4}
        maxLength={NEWS_MAX}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-describedby="news-left"
      />
      <p id="news-left" className={styles.note} aria-live="polite">
        {t("left", { count: NEWS_MAX - text.length })}
      </p>
    </>
  );
}
