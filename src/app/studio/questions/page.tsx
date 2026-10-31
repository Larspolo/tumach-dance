import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { tryHref } from "@/lib/examples";
import { listNinaQuestions } from "@/lib/github";
import type { NinaQuestion } from "@/lib/nina-question";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { AnswerForm } from "./answer-form";

// The page "For Nina" (#68): the open questions of the tickets with the label `for-nina`, and her answer.
export default async function QuestionsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioQuestions");
  const sent = Number((await searchParams).sent) || null;

  let questions: NinaQuestion[] = [];
  let failed = false;
  try {
    questions = (await listNinaQuestions()).filter((q) => q.number !== sent);
  } catch {
    failed = true;
  }

  return (
    <main className={styles.main}>
      <Link className={styles.link} href="/studio">
        {t("back")}
      </Link>
      <h1 className={styles.title}>{t("title")}</h1>
      {sent && (
        <p className={styles.note} role="status">
          {t("thanks")}
        </p>
      )}
      {failed && <p className={styles.error}>{t("loadError")}</p>}
      {!failed && questions.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {questions.map((question) => (
          <li key={question.number} className={styles.item}>
            <h2 className={styles.label}>{question.title}</h2>
            {question.text && <p className={styles.note}>{question.text}</p>}
            {question.tryPath && (
              <p>
                <a className={styles.link} href={tryHref(question) ?? question.tryPath}>
                  {t("try")}
                </a>
              </p>
            )}
            <AnswerForm question={question} />
          </li>
        ))}
      </ul>
    </main>
  );
}
