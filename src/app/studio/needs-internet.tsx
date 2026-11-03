"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import studio from "./studio.module.css";

// With no internet, a form of the studio app changes nothing and says why (#748). One listener on `document` in the
// capture phase runs before the form action of React, so it stops each form of the app.
export default function NeedsInternet() {
  const t = useTranslations("StudioHome");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onSubmit = (event: Event) => {
      if (navigator.onLine) return;
      event.preventDefault();
      event.stopPropagation();
      setShown(true);
      clearTimeout(timer);
      timer = setTimeout(() => setShown(false), 6000);
    };
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("submit", onSubmit, true);
      clearTimeout(timer);
    };
  }, []);
  return shown ? (
    <p role="alert" className={studio.needsInternet}>
      {t("needsInternet")}
    </p>
  ) : null;
}

/** True when an error of a server action is a lost connection (a bad Wi-Fi with `navigator.onLine` true). */
export function isNetworkError(error: Error): boolean {
  return (
    (typeof navigator !== "undefined" && !navigator.onLine) ||
    (error.name === "TypeError" && /fetch|network|load failed/i.test(error.message))
  );
}
