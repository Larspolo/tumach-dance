"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ShareLocale } from "@/lib/free-times-text";
import styles from "../studio.module.css";

// Share the free times of one offer (#728, epic #723): the share sheet of the phone; with no share (a laptop
// browser), the clipboard. The server made the text in both languages; Nina chooses one.
export function ShareButton({ texts, locale }: { texts: Record<ShareLocale, string>; locale: ShareLocale }) {
  const t = useTranslations("StudioShare");
  const [language, setLanguage] = useState<ShareLocale>(locale);
  const [copied, setCopied] = useState(false);
  return (
    <div className={styles.form}>
      <label className={styles.form}>
        <span className={styles.label}>{t("language")}</span>
        <select
          className={styles.input}
          value={language}
          onChange={(event) => setLanguage(event.target.value as ShareLocale)}
        >
          <option value="en">{t("languageEn")}</option>
          <option value="nl">{t("languageNl")}</option>
        </select>
      </label>
      <button
        className={styles.button}
        type="button"
        onClick={async () => {
          const text = texts[language];
          if (typeof navigator.share === "function") {
            try {
              await navigator.share({ text });
            } catch {
              // Nina closed the share sheet: nothing to do.
            }
            return;
          }
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {t("share")}
      </button>
      <p role="status">{copied ? t("copied") : ""}</p>
    </div>
  );
}
