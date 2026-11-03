"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { offlineTimeText } from "@/lib/offline-time";
import styles from "./studio.module.css";

// A line at the top while the phone has no internet (#747): the list can be old. `madeAt`: the time at which the
// server made the page (a page from the cache of the service worker keeps its own time, #746).
export function OfflineNote({ madeAt }: { madeAt: string }) {
  const t = useTranslations("StudioHome");
  const locale = useLocale();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <p className={styles.offline} role="status">
      {t("offline", { time: offlineTimeText(madeAt, new Date().toISOString(), locale) })}
    </p>
  );
}
