"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./LanguageSwitcher.module.css";

// One link per language to the same page; next-intl keeps the choice in the NEXT_LOCALE cookie (#42).
export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav aria-label={t("label")} data-testid="language-switcher" className={styles.switcher}>
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={styles.link}
        >
          {new Intl.DisplayNames([l], { type: "language" }).of(l)}
        </Link>
      ))}
    </nav>
  );
}
