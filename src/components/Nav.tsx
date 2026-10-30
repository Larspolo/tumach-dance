import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";
import styles from "./Nav.module.css";

// The links go to the sections of the home page; as in the reference, a phone shows only the logo.
const SECTIONS = ["about", "classes", "schedule", "contact"] as const;

export function Nav() {
  const t = useTranslations("Nav");
  return (
    <div className={styles.nav}>
      <nav aria-label={t("label")}>
        <Link href="/" className={styles.logo}>
          {t("logo")}
          <span className={styles.dot}>.</span>
        </Link>
        <ul className={styles.links}>
          {SECTIONS.map((id) => (
            <li key={id}>
              <Link href={{ pathname: "/", hash: id }}>{t(id)}</Link>
            </li>
          ))}
        </ul>
      </nav>
      <LanguageSwitcher />
    </div>
  );
}
