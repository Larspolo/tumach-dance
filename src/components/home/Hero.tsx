import { useTranslations } from "next-intl";
import styles from "./Home.module.css";

export function Hero() {
  const t = useTranslations("HomePage");
  return (
    <header className={styles.hero}>
      <div className={styles.heroText}>
        <div className={styles.eyebrow}>{t("eyebrow")}</div>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.heroSub}>{t("welcome")}</p>
        <div className={styles.actions}>
          <a href="#schedule" className={styles.btn}>
            {t("primaryAction")}
          </a>
          <a href="#about" className={`${styles.btn} ${styles.ghost}`}>
            {t("secondaryAction")}
          </a>
        </div>
      </div>
      {/* A plain block in the place of the photo: site:photos adds it. */}
      <div className={styles.heroImg} role="img" aria-label={t("imageBlock")} />
    </header>
  );
}
