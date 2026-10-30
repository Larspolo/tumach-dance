import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import styles from "../studio.module.css";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  await setStudioLocale();
  const t = await getTranslations("StudioLogin");
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <LoginForm />
    </main>
  );
}
