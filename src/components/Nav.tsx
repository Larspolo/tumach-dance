import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./Nav.module.css";

// The reference has only the logo in its nav (its links are commented out), so there is no phone menu.
export function Nav() {
  const t = useTranslations("Nav");
  return (
    <nav className={styles.nav} aria-label={t("label")}>
      <Link href="/" className={styles.logo}>
        {t("logo")}
        <span className={styles.dot}>.</span>
      </Link>
    </nav>
  );
}
