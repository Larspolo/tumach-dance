import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { countNinaQuestions } from "@/lib/github";
import { vapidPublicKey } from "@/lib/push";
import { LOGIN_PATH } from "@/lib/studio-paths";
import { PushButtons } from "../push-buttons";
import styles from "../studio.module.css";

// The testing of the app (Nina, #838): the questions for Nina, the test push, the feedback and the guide.
export default async function TestingPage() {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  const locale = await setStudioLocale();
  const t = await getTranslations("StudioHome");
  const guide = await getTranslations("StudioGuide");
  // The number of open questions shows Nina at once that a question waits (#130).
  const questionCount = await countNinaQuestions();
  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("testing")}</h1>
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/questions">
          {questionCount ? t("questionsCount", { count: questionCount }) : t("questions")}
        </Link>
      </p>
      <PushButtons vapidKey={vapidPublicKey()} />
      <p className={styles.tileRow}>
        <Link className={styles.tile} href="/studio/feedback">
          {t("feedback")}
        </Link>
      </p>
      <p className={styles.tileRow}>
        <a className={styles.tile} href={`/${locale}/studio-guide`}>
          {guide("link")}
        </a>
      </p>
    </main>
  );
}
