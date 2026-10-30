"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

// One link per language to the same page; next-intl keeps the choice in the NEXT_LOCALE cookie (#42).
export default function LanguageSwitcher() {
  const t = useTranslations("LanguageSwitcher");
  const current = useLocale();
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      data-testid="language-switcher"
      style={{
        display: "flex",
        justifyContent: "flex-end",
        gap: "1rem",
        padding: "0.6rem 1rem",
        fontFamily: '"Space Mono", monospace',
        fontSize: "0.75rem",
        letterSpacing: "0.05em",
      }}
    >
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          aria-current={l === current ? "true" : undefined}
          style={{
            color: l === current ? "#a8503a" : "#141210",
            textDecoration: l === current ? "underline" : "none",
            textUnderlineOffset: "0.3em",
          }}
        >
          {new Intl.DisplayNames([l], { type: "language" }).of(l)}
        </Link>
      ))}
    </nav>
  );
}
