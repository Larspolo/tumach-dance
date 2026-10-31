import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./Footer.module.css";

export function Footer() {
  const t = useTranslations("Footer");
  return (
    <footer className={styles.footer}>
      <span>
        {t("copyright", { year: new Date().getFullYear() })} <span className={styles.domain}>{t("domain")}</span>
      </span>
      <span>{t("tagline")}</span>
      <span>{t("place")}</span>
      <Link className={styles.link} href="/privacy">
        {t("privacy")}
      </Link>
    </footer>
  );
}
