import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db";
import { setStudioLocale } from "@/i18n/studio";
import { getStudioSession } from "@/lib/auth";
import { listContactMessages, MESSAGE_KEEP_MONTHS } from "@/lib/contact-store";
import { TIME_ZONE } from "@/lib/hours";
import { LOGIN_PATH } from "@/lib/studio-paths";
import styles from "../studio.module.css";
import { ReplyForm } from "./reply-form";

// The page "Messages" (#533): the messages of the contact form, newest first, and the answer of Nina.
export default async function MessagesPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  const session = await getStudioSession(await headers());
  if (!session) redirect(LOGIN_PATH);
  await setStudioLocale();
  const t = await getTranslations("StudioMessages");
  const locale = await getLocale();
  const sent = Number((await searchParams).sent) || null;
  const when = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
  const messages = listContactMessages(getDb());

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
      {messages.length === 0 && <p className={styles.note}>{t("none")}</p>}
      <ul className={styles.list}>
        {messages.map((m) => (
          <li key={m.id} className={styles.item}>
            <h2 className={styles.label}>{m.name}</h2>
            <p className={styles.note}>
              <a className={styles.link} href={`mailto:${m.email}`}>
                {m.email}
              </a>
              {" · "}
              <time dateTime={new Date(m.createdAt).toISOString()}>{when.format(new Date(m.createdAt))}</time>
            </p>
            <p className={styles.pre}>{m.message}</p>
            {m.answeredAt !== null ? (
              <>
                <p className={styles.note}>{t("answered", { when: when.format(new Date(m.answeredAt)) })}</p>
                <p className={`${styles.note} ${styles.pre}`}>{m.answer}</p>
              </>
            ) : (
              <ReplyForm id={m.id} />
            )}
          </li>
        ))}
      </ul>
      <p className={styles.note}>{t("keep", { months: MESSAGE_KEEP_MONTHS })}</p>
    </main>
  );
}
