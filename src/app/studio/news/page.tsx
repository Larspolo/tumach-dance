import { DateTime } from "luxon";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { TIME_ZONE } from "@/lib/hours";
import { getNewsNote } from "@/lib/news-note";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { removeNews, saveNews } from "./actions";
import { NewsText } from "./news-text";

const ERRORS = ["empty", "long", "date"] as const;

// "News" (#654): Nina writes, changes or removes the short note of the home page, with an optional end date.
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ done?: string; error?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioNews");
  const { done, error } = await searchParams;
  const note = getNewsNote(getDb());
  const today = DateTime.now().setZone(TIME_ZONE).toISODate() ?? "";
  const date = new Intl.DateTimeFormat(locale, { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
  const showDate = (iso: string) => date.format(new Date(`${iso}T12:00:00Z`));
  const errorKey = ERRORS.find((e) => e === error);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      {done === "saved" && <p role="status">{t("saved")}</p>}
      {done === "removed" && <p role="status">{t("removed")}</p>}
      {errorKey && (
        <p role="alert" className={styles.error}>
          {t(`error.${errorKey}`)}
        </p>
      )}
      <h2 className={styles.label}>{t("now")}</h2>
      {note ? (
        <>
          <blockquote>{note.text}</blockquote>
          <p className={styles.note}>{note.until ? t("until", { date: showDate(note.until) }) : t("noEnd")}</p>
          <form action={removeNews}>
            <button className={styles.link} type="submit">
              {t("remove")}
            </button>
          </form>
        </>
      ) : (
        <p className={styles.note}>{t("none")}</p>
      )}
      <form action={saveNews} className={styles.group}>
        <NewsText initial={note?.text ?? ""} />
        <label className={styles.label} htmlFor="news-until">
          {t("endDate")}
        </label>
        <input
          id="news-until"
          name="until"
          type="date"
          className={styles.input}
          min={today}
          defaultValue={note?.until ?? ""}
          aria-describedby="news-until-note"
        />
        <p id="news-until-note" className={styles.note}>
          {t("endDateNote")}
        </p>
        <button className={styles.button} type="submit">
          {t("save")}
        </button>
      </form>
    </main>
  );
}
