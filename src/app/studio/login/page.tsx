import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import styles from "../studio.module.css";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioLogin");
  const guide = await getTranslations("StudioGuide");
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <LoginForm />
      <p className={styles.note}>
        <a className={styles.link} href={`/${locale}/studio-guide`}>
          {guide("link")}
        </a>
      </p>
    </main>
  );
}
