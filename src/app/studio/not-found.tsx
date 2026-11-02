import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import styles from "./studio.module.css";

// The not-found page of the studio app, in its own look, with a link back to its start (#360).
export default async function StudioNotFound() {
  await setStudioLocale();
  const t = await getTranslations("StudioNotFound");
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("text")}</p>
      <p>
        <Link className={styles.link} href="/studio">
          {t("back")}
        </Link>
      </p>
    </main>
  );
}
