import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { type Class, listClasses, listClassTimes } from "@/db/classes";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { CLASS_FIELDS } from "@/lib/class-form";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { changeClass, removeTime } from "./actions";
import { ClassTimeForm } from "./class-time-form";

// The classes of the studio (#96): Nina adds, changes and hides them. Plain HTML forms and one server action.
// Each class shows its weekly times (#97). Each text has an English box; the Dutch boxes are behind "Translations" (P1: a short form).
export default async function ClassesPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioClasses");
  const db = getDb();
  const classes = listClasses(db);
  const times = listClassTimes(db);

  const box = (field: string, lang: string, label: string, value?: string, required = false) => {
    const props = { className: styles.input, name: `${field}_${lang}`, required, defaultValue: value ?? "" };
    return field === "text" ? (
      <label key={props.name} className={styles.form}>
        <span className={styles.label}>{label}</span>
        <textarea {...props} />
      </label>
    ) : (
      <label key={props.name} className={styles.form}>
        <span className={styles.label}>{label}</span>
        <input {...props} />
      </label>
    );
  };
  const fields = (cls?: Class) => (
    <>
      {CLASS_FIELDS.map((f) => box(f, "en", t(f), cls?.[f].en, true))}
      <details className={styles.form}>
        <summary className={styles.link}>{t("translations")}</summary>
        {CLASS_FIELDS.flatMap((f) => [box(f, "nl", t(`${f}In`, { language: t("nl") }), cls?.[f].nl)])}
      </details>
    </>
  );

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      {classes.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {classes.map((cls) => (
          <li key={cls.id}>
            <details className={styles.item}>
              <summary className={styles.summary}>
                <span>{cls.name.en}</span>
                {!cls.visible && <span className={styles.mark}>{t("hidden")}</span>}
              </summary>
              <form className={styles.form} action={changeClass}>
                <input type="hidden" name="id" value={cls.id} />
                {fields(cls)}
                <button className={styles.button} type="submit" name="intent" value="save">
                  {t("save")}
                </button>
              </form>
              <h2 className={styles.label}>{t("times")}</h2>
              {!times.some((time) => time.classId === cls.id) && <p className={styles.note}>{t("noTimes")}</p>}
              <ul className={styles.list}>
                {times
                  .filter((time) => time.classId === cls.id)
                  .map((time) => (
                    <li key={time.id} className={styles.summary}>
                      <span>{t("time", { day: t(`day.${time.weekday}`), from: time.from, to: time.to })}</span>
                      <form action={removeTime}>
                        <input type="hidden" name="id" value={time.id} />
                        <button className={styles.link} type="submit" name="intent" value="removeTime">
                          {t("removeTime")}
                        </button>
                      </form>
                    </li>
                  ))}
              </ul>
              <ClassTimeForm classId={cls.id} />
              <form className={styles.form} action={changeClass}>
                <input type="hidden" name="id" value={cls.id} />
                <button className={styles.link} type="submit" name="intent" value={cls.visible ? "hide" : "show"}>
                  {cls.visible ? t("hide") : t("show")}
                </button>
              </form>
            </details>
          </li>
        ))}
      </ul>
      <details className={styles.item}>
        <summary className={styles.button}>{t("add")}</summary>
        <form className={styles.form} action={changeClass}>
          {fields()}
          <button className={styles.button} type="submit" name="intent" value="add">
            {t("addSave")}
          </button>
        </form>
      </details>
    </main>
  );
}
