"use client";

import { useTranslations } from "next-intl";
import { PageErrorView } from "@/components/PageErrorView";
import { isNetworkError } from "./needs-internet";
import styles from "./studio.module.css";

// A page of the studio app that fails on the server (#362): the look of the app, with a link to the start of the app.
export default function StudioPageError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("PageError");
  const home = useTranslations("StudioHome");
  // A lost connection during a change (#748): the same text as the stop of `needs-internet.tsx`.
  const text = isNetworkError(error) ? home("needsInternet") : t("text");
  return (
    <PageErrorView
      texts={{ title: t("title"), text, retry: t("retry"), home: t("studioHome"), code: t("code") }}
      look={styles}
      homeHref="/studio"
      digest={error.digest}
      reset={reset}
    />
  );
}
