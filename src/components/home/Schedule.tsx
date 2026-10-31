import { useTranslations } from "next-intl";
import type { Class, ClassTime } from "@/db/classes";
import { localText } from "@/lib/local-text";
import styles from "./Home.module.css";
import { SectionHead } from "./SectionHead";

// The weekly times of the visible classes (#98), Monday to Sunday and then by start (`listClassTimes`).
export function Schedule({ classes, times, locale }: { classes: Class[]; times: ClassTime[]; locale: string }) {
  const t = useTranslations("HomePage.schedule");
  const byId = new Map(classes.map((cls) => [cls.id, cls]));
  const rows = times.filter((time) => byId.has(time.classId));
  return (
    <section id="schedule" aria-labelledby="schedule-title" className={`${styles.section} ${styles.schedule}`}>
      <SectionHead id="schedule" title={t("title")} label={t("label")} />
      {rows.length === 0 ? (
        <p className={styles.none}>{t("none")}</p>
      ) : (
        <div className={styles.sched}>
          {rows.map((time) => {
            const cls = byId.get(time.classId) as Class;
            return (
              <div key={time.id} className={styles.row}>
                <span className={styles.day}>{t(`days.${time.weekday}`)}</span>
                <span className={styles.cls}>{localText(cls.name, locale)}</span>
                <span className={styles.time}>{t("time", { from: time.from, to: time.to })}</span>
                <span className={styles.who}>{localText(cls.forWhom, locale)}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
