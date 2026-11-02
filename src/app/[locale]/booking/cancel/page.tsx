import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getDb } from "@/db";
import { cancelLink } from "@/lib/booking-cancel";
import { TIME_ZONE } from "@/lib/hours";
import styles from "../../book/book.module.css";
import { cancelWithLink } from "./actions";

// The page of the cancel link in the emails of a dancer (#164). Opening it (GET) only shows the booking: mail
// scanners open links. The button posts the server action, which checks the token and the rule of #163 again.
export const dynamic = "force-dynamic";

// The token is in the address: no search engine and no referrer gets it. A title names the page for a screen reader (#343).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("cancel.title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

type Search = { token?: string; done?: string };

export default async function CancelPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Search>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token = "", done } = await searchParams;
  const t = await getTranslations("CancelBooking");
  const tBook = await getTranslations("Book");
  const link = cancelLink(getDb(), token);

  const when = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" });
  const contact = (
    <p className={`${styles.note} ${styles.step}`}>
      {t("contactText")}{" "}
      <a className={styles.link} href={`/${locale}#contact`}>
        {t("contact")}
      </a>
    </p>
  );

  if (link.state === "not-found") {
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.error} role="status">
          {t("notFound")}
        </p>
        {contact}
      </main>
    );
  }

  const { booking, offer } = link;
  const offerLabel = tBook(offer.kind, { minutes: offer.minutes });
  const message = done && link.state === "cancelled" ? t("done") : link.state === "open" ? null : t(link.state);

  return (
    <main className={styles.main}>
      <h1 className={styles.title}>{t("title")}</h1>
      <p className={styles.note}>{t("booking", { offer: offerLabel, when: when.format(new Date(booking.start)) })}</p>
      {message && (
        <p className={done ? styles.note : styles.error} role="status">
          {message}
        </p>
      )}
      {link.state === "open" && (
        <form className={styles.form} action={cancelWithLink}>
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="locale" value={locale} />
          {booking.status === "approved" && <p className={styles.note}>{t("noRefund")}</p>}
          <button className={styles.button} type="submit">
            {t("button")}
          </button>
        </form>
      )}
      {link.state === "cancelled" || link.state === "declined" ? (
        <a className={styles.link} href={`/${locale}/book`}>
          {tBook("again")}
        </a>
      ) : null}
      {contact}
    </main>
  );
}
