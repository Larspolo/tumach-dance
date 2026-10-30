import { useTranslations } from "next-intl";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// Static rows: site:schedule fills them from the classes of the studio.
const ROWS = 3;

export function Schedule() {
  const t = useTranslations("HomePage.schedule");
  return (
    <section id="schedule" aria-labelledby="schedule-title" className={`${styles.section} ${styles.schedule}`}>
      <SectionHead id="schedule" title={t("title")} label={t("label")} />
      <div className={styles.sched}>
        {Array.from({ length: ROWS }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder rows
          <div key={i} className={styles.row}>
            <span className={styles.day}>{t("day")}</span>
            <span className={styles.cls}>{t("class")}</span>
            <span className={styles.time}>{t("time")}</span>
            <span className={styles.who}>{t("who")}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
