import { useTranslations } from "next-intl";
import styles from "./Home.module.css";

/** The current note of Nina (#655), in the hero: a phone shows the hero first. Plain text, never HTML. */
export function NewsNote({ text }: { text: string }) {
  const t = useTranslations("HomePage.news");
  return (
    <aside aria-labelledby="news-title" className={styles.news}>
      <h2 id="news-title" className={styles.newsTitle}>
        {t("title")}
      </h2>
      <p className={styles.newsText}>{text}</p>
    </aside>
  );
}
