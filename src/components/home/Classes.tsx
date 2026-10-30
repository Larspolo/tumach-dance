import { useTranslations } from "next-intl";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

const CLASSES = ["one", "two", "three", "four"] as const;

export function Classes() {
  const t = useTranslations("HomePage.classes");
  return (
    <section id="classes" aria-labelledby="classes-title" className={styles.section}>
      <SectionHead id="classes" title={t("title")} label={t("label")} />
      <div className={styles.classGrid}>
        {CLASSES.map((key) => (
          <article key={key} className={styles.card}>
            <span className={styles.kind}>{t(`items.${key}.kind`)}</span>
            <h3>{t(`items.${key}.name`)}</h3>
            <p>{t(`items.${key}.text`)}</p>
            <div className={styles.level}>{t(`items.${key}.level`)}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
