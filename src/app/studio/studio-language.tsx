"use client";

import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import styles from "@/components/LanguageSwitcher.module.css";
import { LOCALE_COOKIE_MAX_AGE, routing } from "@/i18n/routing";
import studio from "./studio.module.css";

// The language control of the studio app (#314). Studio pages have no locale in the address, so the
// `Link locale=` of the public control does not fit: set the `NEXT_LOCALE` cookie of next-intl and render again.
export default function StudioLanguage() {
  const t = useTranslations("LanguageSwitcher");
  const current = useLocale();
  const router = useRouter();
  return (
    <nav aria-label={t("label")} data-testid="language-switcher" className={styles.switcher}>
      {routing.locales.map((l) => (
        <button
          type="button"
          key={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          className={`${styles.link} ${studio.languageButton}`}
          onClick={() => {
            // biome-ignore lint/suspicious/noDocumentCookie: one plain cookie, the same as next-intl sets.
            document.cookie = `NEXT_LOCALE=${l}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
            router.refresh();
          }}
        >
          {new Intl.DisplayNames([l], { type: "language" }).of(l)}
        </button>
      ))}
    </nav>
  );
}
