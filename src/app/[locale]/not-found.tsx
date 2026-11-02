import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./not-found.module.css";

// The page of an unknown address (#359): in the look and the language of the site, with a way back.
export default function NotFound() {
  const t = useTranslations("NotFound");
  return (
    <main className={styles.main}>
      <title>{t("pageTitle")}</title>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("text")}</p>
      <p className={styles.links}>
        <Link className={styles.link} href="/">
          {t("home")}
        </Link>
        <Link className={styles.link} href="/book">
          {t("book")}
        </Link>
      </p>
    </main>
  );
}
