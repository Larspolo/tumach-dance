import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./Nav.module.css";

// The reference has only the logo in its nav (its links are commented out), so there is no phone menu.
// The language switcher takes the place of the links at the right: the fixed bar covers the top of the page.
export function Nav() {
  const t = useTranslations("Nav");
  return (
    <div className={styles.nav}>
      <nav aria-label={t("label")}>
        <Link href="/" className={styles.logo}>
          {t("logo")}
          <span className={styles.dot}>.</span>
        </Link>
      </nav>
      <LanguageSwitcher />
    </div>
  );
}
