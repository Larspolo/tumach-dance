"use client";

import { useLocale, useTranslations } from "next-intl";
import { PageErrorView } from "@/components/PageErrorView";
import styles from "./not-found.module.css";

// A public page that fails on the server (#362): the look of the not-found page (#359), in the language of the page.
export default function PageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("PageError");
  const locale = useLocale();
  return (
    <PageErrorView
      texts={{ title: t("title"), text: t("text"), retry: t("retry"), home: t("home"), code: t("code") }}
      look={styles}
      homeHref={`/${locale}`}
      digest={error.digest}
      reset={reset}
    />
  );
}
