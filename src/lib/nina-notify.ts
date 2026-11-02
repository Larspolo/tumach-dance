// A push to Nina for each new question (#69). A timer of `src/instrumentation.ts` checks the questions on GitHub
// every 5 minutes: a GitHub webhook needs a public endpoint, a secret and a setting on GitHub (P1). The table
// `notified_questions` holds the numbers that had their push. The insert comes before the push, so two checks at
// the same time (two timers after a fast restart) and a check after a restart send no second push.
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import en from "../../messages/en.json";
import nl from "../../messages/nl.json";
import type { Db } from "../db";
import { notifiedQuestions } from "../db/schema";
import { withFallback } from "../i18n/fallback";
import { listNinaQuestions } from "./github";
import { type PushLocale, sendPush } from "./push";

export const CHECK_INTERVAL_MS = 5 * 60_000;
export const QUESTIONS_PATH = "/studio/questions";

const MESSAGES = { en, nl: withFallback(nl, en) };

function questionPush(locale: PushLocale) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "Push" });
  return { title: t("questionTitle"), body: t("questionBody"), url: QUESTIONS_PATH };
}

/** Send one push for each open question that has had none. Gives the numbers of the new questions. */
export async function checkNewQuestions(db: Db, now = Date.now()): Promise<number[]> {
  const questions = await listNinaQuestions();
  const added: number[] = [];
  for (const { number } of questions) {
    const insert = db.insert(notifiedQuestions).values({ number, notifiedAt: now }).onConflictDoNothing().run();
    if (insert.changes === 0) continue;
    try {
      await sendPush(db, questionPush);
    } catch (error) {
      // No push was sent (no VAPID keys): the next check tries again.
      db.delete(notifiedQuestions).where(eq(notifiedQuestions.number, number)).run();
      throw error;
    }
    added.push(number);
  }
  return added;
}

const timer = globalThis as unknown as { tumachQuestionTimer?: NodeJS.Timeout };

/**
 * Start the check of the questions: now and every 5 minutes. Only with a `GITHUB_TOKEN`. An error is logged once
 * (not each 5 minutes until it is fixed); the next check tries again and the timer never stops the server.
 */
export function startQuestionTimer(db: Db, env: NodeJS.ProcessEnv = process.env): NodeJS.Timeout | null {
  if (!env.GITHUB_TOKEN) return null;
  if (timer.tumachQuestionTimer) return timer.tumachQuestionTimer;
  let failing = false;
  const check = () =>
    checkNewQuestions(db).then(
      () => {
        failing = false;
      },
      (error) => {
        if (!failing) console.error("question check failed", error);
        failing = true;
      },
    );
  void check();
  timer.tumachQuestionTimer = setInterval(check, CHECK_INTERVAL_MS);
  timer.tumachQuestionTimer.unref();
  return timer.tumachQuestionTimer;
}
