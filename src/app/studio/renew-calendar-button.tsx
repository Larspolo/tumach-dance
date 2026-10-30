"use client";

import { useTranslations } from "next-intl";
import { renewCalendar } from "./actions";
import styles from "./studio.module.css";

// Asks to confirm first: the old address of the calendar feed stops (#104).
export function RenewCalendarButton() {
  const t = useTranslations("StudioHome");
  return (
    <form
      action={renewCalendar}
      onSubmit={(event) => {
        if (!window.confirm(t("calendarRenewConfirm"))) event.preventDefault();
      }}
    >
      <button className={styles.link} type="submit">
        {t("calendarRenew")}
      </button>
    </form>
  );
}
