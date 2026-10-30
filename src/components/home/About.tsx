import { useTranslations } from "next-intl";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

export function About() {
  const t = useTranslations("HomePage.about");
  return (
    <section id="about" aria-labelledby="about-title" className={`${styles.section} ${styles.about}`}>
      <SectionHead id="about" title={t("title")} label={t("label")} />
      <div className={styles.twoCols}>
        <div>
          <p>{t("text1")}</p>
          <p>{t("text2")}</p>
          <p>{t("text3")}</p>
        </div>
        <blockquote className={styles.pull}>
          {t("quote")}
          <span className={styles.pullBy}>{t("quoteBy")}</span>
        </blockquote>
      </div>
    </section>
  );
}
