import { useTranslations } from "next-intl";
import type { Class } from "@/db/classes";
import { localText } from "@/lib/local-text";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The visible classes of the studio (#98), in the language of the page; English when a text has no translation.
export function Classes({ classes, locale }: { classes: Class[]; locale: string }) {
  const t = useTranslations("HomePage.classes");
  return (
    <section id="classes" aria-labelledby="classes-title" className={styles.section}>
      <SectionHead id="classes" title={t("title")} label={t("label")} />
      {classes.length === 0 ? (
        <p className={styles.none}>{t("none")}</p>
      ) : (
        <div className={styles.classGrid}>
          {classes.map((cls) => (
            <article key={cls.id} className={styles.card}>
              <h3>{localText(cls.name, locale)}</h3>
              <p>{localText(cls.text, locale)}</p>
              <div className={styles.level}>{localText(cls.forWhom, locale)}</div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
