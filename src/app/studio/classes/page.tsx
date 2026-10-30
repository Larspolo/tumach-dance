import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { type Class, listClasses } from "@/db/classes";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { CLASS_FIELDS } from "@/lib/class-form";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { changeClass } from "./actions";

// The classes of the studio (#96): Nina adds, changes and hides them. Plain HTML forms and one server action.
// Each text has an English box; the Dutch and Slovenian boxes are behind "Translations" (P1: a short form).
export default async function ClassesPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioClasses");
  const classes = listClasses(getDb());

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
        {CLASS_FIELDS.flatMap((f) => [
          box(f, "nl", t(`${f}In`, { language: t("nl") }), cls?.[f].nl),
          box(f, "sl", t(`${f}In`, { language: t("sl") }), cls?.[f].sl),
        ])}
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
