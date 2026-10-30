import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { FEEDBACK_MAX } from "@/lib/github";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { FeedbackForm } from "./feedback-form";

// Nina's feedback (#108): a wish, a problem or an idea becomes a GitHub ticket for the agent.
export default async function FeedbackPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioFeedback");
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("intro")}</p>
      <FeedbackForm max={FEEDBACK_MAX} />
    </main>
  );
}
